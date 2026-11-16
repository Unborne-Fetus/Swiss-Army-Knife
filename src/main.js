'use strict';

const {app,BrowserWindow,ipcMain,dialog,shell} = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {getLiveSnapshot,validatePort} = require('./telemetry');
const {listSaves,loadSaveSnapshot} = require('./saves');
const blueprints = require('./blueprints');

const SITES = Object.freeze({
  map:'https://satisfactory-calculator.com/en/interactive-map',
  blueprints:'https://satisfactory-calculator.com/en/blueprints'
});
let mainWindow;
let blueprintBrowser;
let selectedSession='';
let port=8080;
let openingBrowser=false;

function notify(message,isError=false) {
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notice',{message,isError});
}
function settingsFile(){return path.join(app.getPath('userData'),'settings.json');}
async function loadSettings(){
  try {
    const settings=JSON.parse(await fs.readFile(settingsFile(),'utf8'));
    selectedSession=settings.session ? blueprints.safeSession(settings.session) : '';
    port=validatePort(settings.port || 8080);
  } catch {selectedSession='';port=8080;}
}
async function persistSettings(){
  const file=settingsFile();
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify({session:selectedSession,port},null,2));
}
function createMainWindow(){
  mainWindow=new BrowserWindow({
    width:1300,height:830,minWidth:860,minHeight:620,show:false,
    title:'Swiss Army Knife — Satisfactory',
    backgroundColor:'#0c121a',autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      nodeIntegration:false,contextIsolation:true,sandbox:true
    }
  });
  mainWindow.loadFile(path.join(__dirname,'ui','index.html'));
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',event=>event.preventDefault());
}
function openWebsite(which) {
  if(!(which in SITES)) throw new Error('Unknown website.');
  const isBlueprint=which==='blueprints';
  const site = new BrowserWindow({
    width:1280,height:850,minWidth:800,minHeight:550,
    parent:mainWindow,title:isBlueprint?'Satisfactory Calculator — Blueprints':'Satisfactory Calculator — Interactive Map',
    autoHideMenuBar:true,backgroundColor:'#10151b',
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}
  });
  if(isBlueprint) blueprintBrowser=site;
  site.webContents.setWindowOpenHandler(({url})=>{
    if(/^https:\/\//i.test(url)) shell.openExternal(url);
    return {action:'deny'};
  });
  site.webContents.on('will-navigate',(event,url)=>{
    try {
      const target=new URL(url);
      if(target.protocol==='https:' &&
          (target.hostname==='satisfactory-calculator.com' ||
           target.hostname.endsWith('.satisfactory-calculator.com'))) return;
      event.preventDefault();
      if(target.protocol==='https:') shell.openExternal(url);
    } catch {event.preventDefault();}
  });
  site.on('closed',()=>{if(blueprintBrowser===site) blueprintBrowser=undefined;});
  site.loadURL(SITES[which]).catch(error=>notify('Site could not load: '+error.message,true));
}
async function handleDownload(item,source) {
  if(!selectedSession) {
    item.cancel();
    notify('Choose a blueprint session in Swiss Army Knife before downloading.',true);
    return;
  }
  const filename=path.basename(item.getFilename());
  const ext=path.extname(filename).toLowerCase();
  if(!['.sbp','.sbpcfg','.zip'].includes(ext)) return; // normal browser download flow
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'satisfactory-sak-'));
  const tempFile=path.join(temp,filename);
  item.setSavePath(tempFile);
  item.once('done',async (_event,state)=>{
    try {
      if(state!=='completed') throw new Error('Download '+state);
      const output=await blueprints.installBlueprints(selectedSession,[tempFile]);
      notify('Installed '+output.installed.join(', ')+' into '+output.session+'. Reload the save in-game to see it.');
    } catch(error) {
      notify('Blueprint installation failed: '+error.message,true);
    } finally {
      await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
    }
  });
}
function registerDownloads(){
  // Only downloads initiated by our separate blueprint browser are auto-installed.
  const {session}=require('electron');
  session.defaultSession.on('will-download',(event,item,contents)=>{
    if(!blueprintBrowser || blueprintBrowser.isDestroyed() || contents.id !== blueprintBrowser.webContents.id) return;
    const ext=path.extname(item.getFilename()).toLowerCase();
    if(!['.sbp','.sbpcfg','.zip'].includes(ext)) return;
    handleDownload(item,contents).catch(error=>{
      item.cancel();
      notify('Download error: '+error.message,true);
    });
  });
}
function handlers() {
  ipcMain.handle('settings:get',()=>({session:selectedSession,port,blueprintRoot:blueprints.blueprintRoot()}));
  ipcMain.handle('saves:list',()=>listSaves());
  ipcMain.handle('saves:load',(_event,filePath)=>loadSaveSnapshot(filePath));
  ipcMain.handle('saves:choose',async()=>{
    const result=await dialog.showOpenDialog(mainWindow,{
      title:'Open Satisfactory save',properties:['openFile'],
      filters:[{name:'Satisfactory saves',extensions:['sav']}]
    });
    if(result.canceled || !result.filePaths.length) return null;
    return loadSaveSnapshot(result.filePaths[0]);
  });
  ipcMain.handle('live:read',async(_event,newPort)=>{
    port=validatePort(newPort);
    return getLiveSnapshot(port);
  });
  ipcMain.handle('live:save-port',async(_event,newPort)=>{
    port=validatePort(newPort);
    await persistSettings();
    return port;
  });
  ipcMain.handle('blueprints:sessions',()=>blueprints.listSessions());
  ipcMain.handle('blueprints:select',async(_event,session)=>{
    selectedSession=blueprints.safeSession(session);
    await fs.mkdir(path.join(blueprints.blueprintRoot(),selectedSession),{recursive:true});
    await persistSettings();
    return {session:selectedSession,installed:await blueprints.listInstalled(selectedSession)};
  });
  ipcMain.handle('blueprints:installed',()=>selectedSession ? blueprints.listInstalled(selectedSession) : []);
  ipcMain.handle('blueprints:import',async()=>{
    if(!selectedSession) throw new Error('Choose a blueprint session first.');
    const result=await dialog.showOpenDialog(mainWindow,{
      title:'Import blueprints',properties:['openFile','multiSelections'],
      filters:[{name:'Satisfactory blueprints',extensions:['sbp','sbpcfg','zip']}]
    });
    if(result.canceled || !result.filePaths.length) return null;
    return blueprints.installBlueprints(selectedSession,result.filePaths);
  });
  ipcMain.handle('blueprints:open-folder',async()=>{
    if(!selectedSession) throw new Error('Choose a blueprint session first.');
    return shell.openPath(path.join(blueprints.blueprintRoot(),selectedSession));
  });
  ipcMain.handle('site:open',(_event,which)=>openWebsite(which));
  ipcMain.handle('site:external',(_event,which)=>{
    if(!(which in SITES)) throw new Error('Unknown site.');
    return shell.openExternal(SITES[which]);
  });
}
app.whenReady().then(async()=>{
  await loadSettings();
  createMainWindow();
  handlers();
  registerDownloads();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
}).catch(error=>{dialog.showErrorBox('Swiss Army Knife',error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
