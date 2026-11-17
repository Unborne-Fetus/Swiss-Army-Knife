'use strict';
const {contextBridge,ipcRenderer} = require('electron');

const isMissingHandler=error=>/no handler registered/i.test(String(error?.message||error));
async function livePollWithCompatibility(){
  try{return await ipcRenderer.invoke('live:poll');}
  catch(error){
    if(!isMissingHandler(error))throw error;
    try{
      const settings=await ipcRenderer.invoke('settings:get');
      const port=settings?.port||8080;
      const snapshot=await ipcRenderer.invoke('live:read',port);
      return {connected:true,port,snapshot,legacy:true};
    }catch(legacyError){
      return {connected:false,legacy:true,code:'older-main-process',
        message:'The app is running an older background process. Fully close Swiss Army Knife and launch the updated EXE. '+
          (legacyError?.message||String(legacyError))};
    }
  }
}
contextBridge.exposeInMainWorld('sak',{
  settings:()=>ipcRenderer.invoke('settings:get'),
  bridgeStatus:async()=>{
    try{return await ipcRenderer.invoke('bridge:status');}
    catch(error){if(isMissingHandler(error))return null;throw error;}
  },
  livePoll:livePollWithCompatibility,
  autoPort:()=>ipcRenderer.invoke('live:automatic'),
  getAdBlocking:async()=>{
    try{return await ipcRenderer.invoke('adblock:status');}
    catch(error){
      if(!isMissingHandler(error))throw error;
      return {enabled:false,active:false,source:'none',blockedRequests:0,
        error:'Old app engine is running. Close all windows and relaunch Swiss Army Knife.'};
    }
  },
  setAdBlocking:enabled=>ipcRenderer.invoke('adblock:set',enabled),
  onAdBlockState:callback=>{
    const listener=(_event,value)=>callback(value);
    ipcRenderer.on('adblock:state',listener);
    return ()=>ipcRenderer.removeListener('adblock:state',listener);
  },
  autoScan:()=>ipcRenderer.invoke('auto:scan'),
  catalogOpen:()=>ipcRenderer.invoke('catalog:open'),
  toolShow:(name,rect)=>ipcRenderer.invoke('tools:show',name,rect),
  toolReload:name=>ipcRenderer.invoke('tools:reload',name),
  getItemIcon:className=>ipcRenderer.invoke('icons:get',className),
  onToolStatus:callback=>{
    const fn=(_event,value)=>callback(value);
    ipcRenderer.on('tools:status',fn);
    return ()=>ipcRenderer.removeListener('tools:status',fn);
  },
  catalogShow:(show,rect)=>ipcRenderer.invoke('catalog:show',show,rect),
  catalogBack:()=>ipcRenderer.invoke('catalog:back'),
  catalogHome:()=>ipcRenderer.invoke('catalog:home'),
  catalogInstall:()=>ipcRenderer.invoke('catalog:install'),
  onCatalogPage:callback=>{
    const fn=(_e,page)=>callback(page);
    ipcRenderer.on('catalog:page',fn);
    return ()=>ipcRenderer.removeListener('catalog:page',fn);
  },
  useActiveSession:()=>ipcRenderer.invoke('auto:use-active'),
  saves:()=>ipcRenderer.invoke('saves:list'),
  loadSave:path=>ipcRenderer.invoke('saves:load',path),
  chooseSave:()=>ipcRenderer.invoke('saves:choose'),
  live:port=>ipcRenderer.invoke('live:read',port),
  savePort:port=>ipcRenderer.invoke('live:save-port',port),
  sessions:()=>ipcRenderer.invoke('blueprints:sessions'),
  selectSession:name=>ipcRenderer.invoke('blueprints:select',name),
  installed:()=>ipcRenderer.invoke('blueprints:installed'),
  importBlueprints:()=>ipcRenderer.invoke('blueprints:import'),
  openBlueprintFolder:()=>ipcRenderer.invoke('blueprints:open-folder'),
  openSite:which=>ipcRenderer.invoke('site:open',which),
  openSiteExternally:which=>ipcRenderer.invoke('site:external',which),
  onNotice:callback=>{
    const listener=(_event,payload)=>callback(payload);
    ipcRenderer.on('notice',listener);
    return ()=>ipcRenderer.removeListener('notice',listener);
  }
});
