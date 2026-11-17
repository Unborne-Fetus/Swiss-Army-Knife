'use strict';

const {app,BrowserWindow,ipcMain,dialog,shell} = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {getLiveSnapshot,validatePort} = require('./telemetry');
const {listSaves,loadSaveSnapshot} = require('./saves');
const blueprints = require('./blueprints');
const {AutoDiscovery} = require('./autodiscovery');
const {catalog}=require('./catalog');
const {createTools}=require('./embedded-tools');
const {makeIconLoader}=require('./icons');
const {findFRM}=require('./live-diagnostics');
const {makeAdBlock}=require('./adblock');

const SITES = Object.freeze({
  map:'https://satisfactory-calculator.com/en/interactive-map',
  blueprints:'https://satisfactory-calculator.com/en/blueprints',
  production:'https://satisfactory-calculator.com/en/planners/production',
  power:'https://satisfactory-calculator.com/en/planners/power',
  mod:'https://docs.ficsit.app/ficsitremotemonitoring/latest/index.html',
  'mod-install':'https://ficsit.app/mod/FicsitRemoteMonitoring'
});
let mainWindow;
let blueprintBrowser;
let integratedCatalog;
let integratedTools;
const iconLoader=makeIconLoader();
let selectedSession='';
let manualSession=false;
// Save HEADER is used only for blueprint-session detection. Factory quantities
// come solely from live telemetry, avoiding expensive background save parsing.
const autodiscovery=new AutoDiscovery({load:async()=>({
  mode:'save',items:[],warnings:[],rateSource:'unavailable'
})});
let port=8080;
let manualPort=false;
let adBlockingEnabled=true;
let adBlocking=null;

function notify(message,isError=false) {
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('notice',{message,isError});
}
function settingsFile(){return path.join(app.getPath('userData'),'settings.json');}
async function loadSettings(){
  try {
    const settings=JSON.parse(await fs.readFile(settingsFile(),'utf8'));
    selectedSession=settings.session ? blueprints.safeSession(settings.session) : '';
    manualSession=Boolean(settings.manualSession);
    port=validatePort(settings.port || 8080);
    manualPort=Boolean(settings.manualPort);
    adBlockingEnabled=settings.adBlocking!==false;
  } catch {selectedSession='';manualSession=false;port=8080;manualPort=false;adBlockingEnabled=true;}
}
async function persistSettings(){
  const file=settingsFile();
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify({session:selectedSession,manualSession,port,manualPort,adBlocking:adBlockingEnabled},null,2));
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
  integratedCatalog=catalog(mainWindow,notify);
  integratedTools=createTools(mainWindow,notify);
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
const pendingConfigs=new Map();
const pendingExpiryMs=120000;
async function handleDownload(item,source) {
  const targetSession=selectedSession;
  if(!targetSession) {
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
      const base=blueprints.safeBase(filename).toLowerCase();
      const key=targetSession.toLowerCase()+'|'+base;
      if(ext==='.sbpcfg') {
        const installed=await blueprints.listInstalled(targetSession);
        if(!installed.some(f=>f.toLowerCase()===base+'.sbp')&&!pendingConfigs.has(key)){
          const pending={temp,tempFile};
          pendingConfigs.set(key,pending);
          setTimeout(async()=>{
            if(pendingConfigs.get(key)===pending){
              pendingConfigs.delete(key);
              await fs.rm(temp,{recursive:true,force:true}).catch(()=>{});
              notify('Config downloaded for '+base+'; the matching SBP file was not downloaded.',true);
            }
          },pendingExpiryMs).unref();
          notify('Blueprint config received. Finishing installation when the matching SBP downloads.');
          return;
        }
      }
      const extra=pendingConfigs.get(key);
      const paths=ext==='.sbp'&&extra?[tempFile,extra.tempFile]:[tempFile];
      const output=await blueprints.installBlueprints(targetSession,paths);
      if(ext==='.sbp'&&extra){
        pendingConfigs.delete(key);
        await fs.rm(extra.temp,{recursive:true,force:true}).catch(()=>{});
      }
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
    const fromStandalone=blueprintBrowser&&!blueprintBrowser.isDestroyed()&&contents&&contents.id===blueprintBrowser.webContents.id;
    const fromIntegrated=integratedCatalog&&contents&&contents.id===integratedCatalog.wc.id;
    if(!fromStandalone&&!fromIntegrated)return;
    const ext=path.extname(item.getFilename()).toLowerCase();
    if(!['.sbp','.sbpcfg','.zip'].includes(ext)) return;
    handleDownload(item,contents).catch(error=>{
      item.cancel();
      notify('Download error: '+error.message,true);
    });
  });
}
async function scanActiveSave() {
  const result=await autodiscovery.scan();
  if(result.latest && !manualSession && result.latest.session!==selectedSession) {
    selectedSession=result.latest.session;
    // Create the blueprint folder automatically, even for a first-time session.
    await fs.mkdir(path.join(blueprints.blueprintRoot(),selectedSession),{recursive:true});
    await persistSettings();
  }
  return {...result,selectedSession,manualSession};
}

async function ensureProtection(){
  if(adBlockingEnabled&&adBlocking&&!adBlocking.status().active)
    return adBlocking.setEnabled(true);
}

function handlers() {
  // Bootstrap contract: the UI must know which Electron main version it is
  // speaking with. Register every IPC handler BEFORE the renderer loads.
  ipcMain.handle('bridge:status',()=>({
    version:app.getVersion(),
    protocol:2,
    features:['live:poll','adblock:status','adblock:set','live:automatic']
  }));
  ipcMain.handle('adblock:status',()=>adBlocking?adBlocking.status():{
    enabled:adBlockingEnabled,active:false,loading:true,error:null
  });
  ipcMain.handle('adblock:set',async(_event,enabled)=>{
    if(typeof enabled!=='boolean')throw Error('Invalid privacy setting.');
    adBlockingEnabled=enabled;
    await persistSettings();
    if(!adBlocking)throw Error('Ad blocking engine is still initializing.');
    return adBlocking.setEnabled(enabled);
  });
  ipcMain.handle('live:poll',async()=>{
    const result=await findFRM(port,{manual:manualPort});
    if(!result.ok)return {connected:false,code:result.code,port,attempted:result.attempted,
      config:result.config,message:result.message};
    try{
      const snapshot=await getLiveSnapshot(result.port,{world:result.world});
      if(port!==result.port){
        port=result.port;
        await persistSettings();
      }
      return {connected:true,port,snapshot};
    }catch(error){
      return {connected:false,code:'incompatible',port:result.port,
        config:result.config,message:'FRM is responding on port '+result.port+
          ', but the data could not be read: '+(error.message||String(error))};
    }
  });
  ipcMain.handle('live:automatic',async()=>{
    manualPort=false;
    port=8080;
    await persistSettings();
    return {port,manualPort};
  });
  ipcMain.handle('tools:show',async(_event,name,rect)=>{
    if(name!==null)await ensureProtection();
    return integratedTools.show(name,rect);
  });
  ipcMain.handle('tools:reload',(_event,name)=>integratedTools.reload(name));
  ipcMain.handle('icons:get',(_event,className)=>iconLoader.get(port,className));
  ipcMain.handle('catalog:open',async()=>{
    await ensureProtection();
    return integratedCatalog.open();
  });
  ipcMain.handle('catalog:show',(_e,show,rect)=>{
    if(typeof show!=='boolean')throw Error('Bad visibility flag');
    let bounds;
    if(show){
      const [w,h]=mainWindow.getContentSize();
      if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('Invalid bounds');
      const x=Math.max(0,Math.min(w-1,Math.floor(rect.x)));
      const y=Math.max(0,Math.min(h-1,Math.floor(rect.y)));
      bounds={x,y,width:Math.max(1,Math.min(w-x,Math.floor(rect.width))),height:Math.max(1,Math.min(h-y,Math.floor(rect.height)))};
    }
    integratedCatalog.show(show,bounds);
  });
  ipcMain.handle('catalog:back',()=>integratedCatalog.back());
  ipcMain.handle('catalog:home',()=>integratedCatalog.home());
  ipcMain.handle('catalog:install',()=>{
    if(!selectedSession)throw Error('No save session detected. Save a game first.');
    return integratedCatalog.install();
  });
  ipcMain.handle('auto:scan',()=>scanActiveSave());
  ipcMain.handle('auto:use-active',async()=>{
    manualSession=false;
    selectedSession='';
    await persistSettings();
    return scanActiveSave();
  });
  ipcMain.handle('settings:get',()=>({session:selectedSession,manualSession,port,manualPort,adBlocking:adBlockingEnabled,blueprintRoot:blueprints.blueprintRoot()}));
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
    manualPort=true;
    await persistSettings();
    return port;
  });
  ipcMain.handle('blueprints:sessions',()=>blueprints.listSessions());
  ipcMain.handle('blueprints:select',async(_event,session)=>{
    selectedSession=blueprints.safeSession(session);
    manualSession=true;
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
  ipcMain.handle('site:open',async(_event,which)=>{
    await ensureProtection();
    return openWebsite(which);
  });
  ipcMain.handle('site:external',(_event,which)=>{
    if(!(which in SITES)) throw new Error('Unknown site.');
    return shell.openExternal(SITES[which]);
  });
}
app.whenReady().then(async()=>{
  await loadSettings();
  // IPC must be ready before we load the index.html renderer.
  handlers();
  registerDownloads();
  const {session}=require('electron');
  adBlocking=makeAdBlock({
    ses:session.defaultSession,
    cacheDir:path.join(app.getPath('userData'),'adblock-cache')
  });
  // Start protection before third-party web views are opened. Keep the
  // application responsive while remote filter lists download.
  const protectionStartup=adBlocking.setEnabled(adBlockingEnabled);
  createMainWindow();
  protectionStartup.then(result=>{
    if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('adblock:state',result);
    if(result.error)notify('Ad/tracker filter startup: '+result.error,true);
  }).catch(error=>notify('Ad blocking setup failed: '+error.message,true));
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
}).catch(error=>{dialog.showErrorBox('Swiss Army Knife',error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
