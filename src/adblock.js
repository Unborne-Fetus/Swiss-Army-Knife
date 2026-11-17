'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

/**
 * Electron cannot run the real uBlock Origin Lite MV3 extension: the
 * declarativeNetRequest extension API is not supported. Use a maintained
 * Electron-native blocker with uBlock/EasyList-compatible filtering.
 */
function makeAdBlock({ses,cacheDir,fetcher=fetch,loadEngine}){
  let engine=null,enabled=false,loading=null,lastError=null;
  const loader=loadEngine||async()=>{
    const {ElectronBlocker}=await import('@ghostery/adblocker-electron');
    await fs.mkdir(cacheDir,{recursive:true});
    return ElectronBlocker.fromPrebuiltAdsAndTracking(fetcher,{
      path:path.join(cacheDir,'filters.bin'),read:fs.readFile,write:fs.writeFile
    });
  };
  async function setEnabled(value){
    if(typeof value!=='boolean')throw Error('Invalid ad-blocking preference.');
    enabled=value;
    if(!value){
      if(engine?.isBlockingEnabled(ses))engine.disableBlockingInSession(ses);
      return status();
    }
    if(!loading&&!engine){
      loading=Promise.resolve().then(loader).then(result=>{engine=result;lastError=null;})
        .catch(error=>{lastError=String(error.message||error);})
        .finally(()=>{loading=null;});
    }
    if(loading)await loading;
    if(enabled&&engine&&!engine.isBlockingEnabled(ses))engine.enableBlockingInSession(ses);
    return status();
  }
  function status(){
    return {enabled,active:!!engine&&engine.isBlockingEnabled(ses),
      loading:!!loading,error:lastError,
      implementation:'Electron-native filter engine (uBlock/EasyList-compatible; not the uBlock Origin Lite extension)'};
  }
  return {setEnabled,status};
}
module.exports={makeAdBlock};
