'use strict';

const {WebContentsView,shell}=require('electron');
const {TOOL_URLS,allowedToolUrl,clampBounds}=require('./embedded-tools-urls');
function createTools(window,notify){
  const byName=new Map();
  for(const [name,home] of Object.entries(TOOL_URLS)){
    const view=new WebContentsView({
      webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}
    });
    window.contentView.addChildView(view);
    view.setVisible(false);
    const wc=view.webContents;
    const state={name,home,view,wc,loaded:false};
    byName.set(name,state);
    const status=(kind,detail)=>{if(!window.isDestroyed())window.webContents.send('tools:status',{name,kind,detail});};
    wc.on('did-finish-load',()=>status('ready',wc.getURL()));
    wc.on('did-fail-load',(_event,code,description,_url,isMainFrame)=>{
      if(isMainFrame&&code!==-3)status('error',description);
    });
    wc.setWindowOpenHandler(({url})=>{
      if(allowedToolUrl(url))wc.loadURL(url).catch(e=>status('error',e.message));
      else if(/^https:\/\//i.test(url))shell.openExternal(url);
      return {action:'deny'};
    });
    wc.on('will-navigate',(event,url)=>{
      if(allowedToolUrl(url))return;
      event.preventDefault();
      if(/^https:\/\//i.test(url))shell.openExternal(url);
    });
  }
  window.on('closed',()=>{
    for(const state of byName.values())if(!state.wc.isDestroyed())state.wc.close();
  });
  return {
    async show(name,rect){
      for(const state of byName.values())state.view.setVisible(false);
      if(name===null)return;
      const state=byName.get(name);
      if(!state)throw Error('Unknown Satisfactory tool.');
      state.view.setBounds(clampBounds(rect,window.getContentSize()));
      state.view.setVisible(true);
      if(!state.loaded){
        state.loaded=true;
        try{await state.wc.loadURL(state.home);}
        catch(e){state.loaded=false;notify('Cannot open '+name+': '+e.message,true);}
      }
    },
    home(name){
      const state=byName.get(name);
      if(!state)throw Error('Unknown Satisfactory tool.');
      return state.wc.loadURL(state.home);
    },
    reload(name){
      const state=byName.get(name);
      if(!state)throw Error('Unknown Satisfactory tool.');
      state.wc.reload();
    }
  };
}
module.exports={TOOL_URLS,allowedToolUrl,clampBounds,createTools};
