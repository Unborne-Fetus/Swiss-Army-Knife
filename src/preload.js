'use strict';
const {contextBridge,ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('sak',{
  settings:()=>ipcRenderer.invoke('settings:get'),
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
