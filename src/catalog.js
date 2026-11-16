'use strict';
const {WebContentsView,shell}=require('electron');
const HOME='https://satisfactory-calculator.com/en/blueprints';
function allowed(url){
  try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='satisfactory-calculator.com'&&u.pathname.startsWith('/en/blueprints');}
  catch{return false;}
}
function detail(url){
  try{return allowed(url)&&/^\/en\/blueprints\/index\/details\/id\/\d+(\/|$)/.test(new URL(url).pathname);}
  catch{return false;}
}
function catalog(win,notify){
  const view=new WebContentsView({webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.contentView.addChildView(view);
  view.setVisible(false);
  const wc=view.webContents;
  let loaded=false;
  function update(){
    if(!win.isDestroyed())win.webContents.send('catalog:page',{isDetail:detail(wc.getURL()),canGoBack:wc.navigationHistory.canGoBack()});
  }
  wc.on('did-navigate',update);wc.on('did-navigate-in-page',update);
  wc.on('did-fail-load',(_e,code,msg,_url,main)=>{if(main&&code!==-3)notify('Blueprint catalog: '+msg,true);});
  wc.on('will-navigate',(e,url)=>{
    if(allowed(url))return;
    e.preventDefault();
    if(/^https:\/\//i.test(url))shell.openExternal(url);
  });
  wc.setWindowOpenHandler(({url})=>{
    if(allowed(url))wc.loadURL(url).catch(e=>notify(e.message,true));
    else if(/^https:\/\//i.test(url))shell.openExternal(url);
    return {action:'deny'};
  });
  win.on('closed',()=>{if(!wc.isDestroyed())wc.close();});
  return {
    wc,
    async open(){if(!loaded){await wc.loadURL(HOME);loaded=true;}update();},
    show(visible,bounds){if(bounds)view.setBounds(bounds);view.setVisible(visible);},
    back(){if(wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();},
    home(){return wc.loadURL(HOME);},
    async install(){
      if(!detail(wc.getURL()))throw Error('Open a blueprint details page first.');
      const js="(function(){const a=Array.from(document.querySelectorAll('a[href]'));const kinds=['/index/download/','/index/download-cfg/'];const links=kinds.map(k=>a.find(x=>{try{let u=new URL(x.href,location.href);return u.origin===location.origin && u.pathname.includes(k);}catch{return false;}}));if(links.some(x=>!x))return false;links.forEach(x=>x.click());return true;})()";
      if(!await wc.executeJavaScript(js,true))throw Error('Both download links were not available.');
      return {started:true};
    }
  };
}
module.exports={catalog,allowed,detail};
