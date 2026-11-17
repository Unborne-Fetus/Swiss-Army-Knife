'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');

// Fallback is deliberately small. It is NOT uBlock Origin Lite or the complete
// Ghostery ruleset, but avoids a total failure if rule downloads are blocked.
const FALLBACK_RULES=[
  '! Fallback ad/tracker filter rules for limited/offline use',
  '||doubleclick.net^',
  '||googlesyndication.com^',
  '||googleadservices.com^',
  '||googletagmanager.com^',
  '||google-analytics.com^',
  '||amazon-adsystem.com^',
  '||adnxs.com^',
  '||taboola.com^',
  '||outbrain.com^',
  '||criteo.com^',
  '||adsrvr.org^',
  '||pubmatic.com^',
  '||rubiconproject.com^',
  '||openx.net^',
  '||scorecardresearch.com^',
  '||quantserve.com^',
  '||casalemedia.com^'
].join('\n');

function makeAdBlock({ses,cacheDir,fetcher=fetch,loadEngine}){
  let engine=null,enabled=false,loading=null,lastError=null,source='none',blockedRequests=0;
  const loader=loadEngine||(async()=>{
    const {ElectronBlocker}=await import('@ghostery/adblocker-electron');
    await fs.mkdir(cacheDir,{recursive:true});
    try {
      const blocker=await ElectronBlocker.fromPrebuiltAdsAndTracking(fetcher,{
        path:path.join(cacheDir,'filters.bin'),read:fs.readFile,write:fs.writeFile
      });
      return {engine:blocker,source:'full'};
    }catch(error){
      // Offline users still get a small, transparent set of rules.
      const blocker=ElectronBlocker.parse(FALLBACK_RULES);
      return {engine:blocker,source:'fallback',
        warning:'Full filter lists unavailable: '+String(error.message||error)};
    }
  });

  function trackBlocks(instance){
    if(typeof instance.onBeforeRequest!=='function')return;
    const original=instance.onBeforeRequest.bind(instance);
    instance.onBeforeRequest=(details,callback)=>original(details,result=>{
      if(result && (result.cancel===true||result.redirectURL))blockedRequests++;
      callback(result);
    });
  }
  async function setEnabled(value){
    if(typeof value!=='boolean')throw Error('Invalid ad-blocking preference.');
    enabled=value;
    if(!value){
      try{
        if(engine&&engine.isBlockingEnabled(ses))engine.disableBlockingInSession(ses);
      }catch(error){lastError='Disable failed: '+String(error.message||error);}
      return status();
    }
    if(!loading&&!engine){
      loading=Promise.resolve().then(loader).then(result=>{
        const wrapped=result&&result.engine?result:{engine:result,source:'custom'};
        engine=wrapped.engine;
        source=wrapped.source||'custom';
        lastError=wrapped.warning||null;
        trackBlocks(engine);
      }).catch(error=>{lastError=String(error.message||error);})
        .finally(()=>{loading=null;});
    }
    if(loading)await loading;
    if(enabled&&engine&&!engine.isBlockingEnabled(ses)){
      try{engine.enableBlockingInSession(ses);}
      catch(error){lastError='Filter activation failed: '+String(error.message||error);}
    }
    return status();
  }
  function status(){
    let active=false;
    try{active=!!engine&&engine.isBlockingEnabled(ses);}
    catch(error){lastError='Filter status failed: '+String(error.message||error);}
    return {enabled,active,loading:!!loading,error:lastError,
      source,blockedRequests,implementation:'Electron-native uBlock/EasyList-compatible blocking (not the uBlock Origin Lite extension)'};
  }
  return {setEnabled,status};
}
module.exports={makeAdBlock,FALLBACK_RULES};
