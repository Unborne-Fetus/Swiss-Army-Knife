'use strict';
const {contextBridge,ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('sak',{
  settings:()=>ipcRenderer.invoke('settings:get'),
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
