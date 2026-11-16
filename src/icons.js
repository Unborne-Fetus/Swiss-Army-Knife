'use strict';

const PNG_HEADER=Buffer.from([137,80,78,71,13,10,26,10]);
function cleanClassName(value){
  if(typeof value!=='string' || value.length>128 ||
     !/^[A-Za-z0-9_]+$/.test(value)) return null;
  return value;
}
function makeIconLoader(fetcher=fetch){
  const cache=new Map();
  async function get(port,className){
    const clean=cleanClassName(className);
    if(!clean)return null;
    const n=Number(port);
    if(!Number.isInteger(n)||n<1||n>65535)return null;
    const key=n+'|'+clean;
    if(cache.has(key))return cache.get(key);
    const request=(async()=>{
      try{
        const url='http://127.0.0.1:'+n+'/Icons/'+encodeURIComponent(clean)+'.png';
        const response=await fetcher(url,{signal:AbortSignal.timeout(4000)});
        if(!response.ok)return null;
        if(Number(response.headers.get('content-length')||0)>512*1024)return null;
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length<32||bytes.length>512*1024||
           !bytes.subarray(0,8).equals(PNG_HEADER))return null;
        return 'data:image/png;base64,'+bytes.toString('base64');
      }catch{return null;}
    })();
    cache.set(key,request);
    const result=await request;
    if(!result){
      // Retry missing icons in the next polling cycle after the game starts.
      cache.delete(key);
    }
    return result;
  }
  return {get};
}
module.exports={cleanClassName,makeIconLoader};
