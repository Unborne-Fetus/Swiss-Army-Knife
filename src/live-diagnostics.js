'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const COMMON_PORTS=Object.freeze([8080,8081,8090]);
function extractFRMConfig(ini=''){
  if(typeof ini!=='string')return {detected:false,port:null,autostart:null};
  const detected=/FicsitRemoteMonitoring\./i.test(ini);
  const portLine=ini.split(/\r?\n/).find(line=>/^\s*(?:FicsitRemoteMonitoring\.)?(?:Server\.)?uWS\.Port\s*=/i.test(line));
  let port=null;
  if(portLine){
    const right=portLine.slice(portLine.indexOf('=')+1);
    const found=right.match(/mStringValue\s*=\s*["']?(\d{1,5})/i)||
      right.match(/^\s*["']?(\d{1,5})/);
    const value=found&&Number(found[1]);
    if(Number.isInteger(value)&&value>=1&&value<=65535)port=value;
  }
  const autostartLine=ini.split(/\r?\n/).find(line=>/^\s*(?:FicsitRemoteMonitoring\.)?(?:Server\.)?uWS\.Autostart\s*=/i.test(line));
  let autostart=null;
  if(autostartLine){
    const value=autostartLine.slice(autostartLine.indexOf('=')+1);
    const match=value.match(/mIntValue\s*=\s*["']?(\w+)/i)||value.match(/^\s*["']?(\w+)/);
    if(match)autostart=['1','true'].includes(match[1].toLowerCase());
  }
  return {detected,port,autostart};
}
function settingsPath(localAppData=process.env.LOCALAPPDATA){
  return path.join(localAppData||path.join(process.env.HOME||'','AppData','Local'),
    'FactoryGame','Saved','Config','Windows','GameUserSettings.ini');
}
async function readFRMConfig(readFile=fs.readFile,file=settingsPath()){
  try{return extractFRMConfig(await readFile(file,'utf8'));}
  catch(e){if(e.code==='ENOENT'||e.code==='EACCES')return {detected:false,port:null,autostart:null};throw e;}
}
function candidatePorts(requestedPort,configPort,manual=false) {
  const ports=[requestedPort,...(manual?[]:[configPort,...COMMON_PORTS])]
    .map(v=>Number(v)).filter(v=>Number.isInteger(v)&&v>=1&&v<=65535);
  return [...new Set(ports)].slice(0,5);
}
function helpfulMessage(code,config={},port=8080){
  if(code==='unauthorized')return 'Monitoring responded but denied access. Check the FRM HTTP settings and access token.';
  if(code==='wrong-service')return 'A different service is listening on port '+port+
    '. Open Settings to select the FRM port or enable the FRM HTTP server.';
  if(code==='incompatible')return 'The service on port '+port+
    ' did not return the expected FRM inventory data. Check the mod version and HTTP configuration.';
  const install='Install Ficsit Remote Monitoring via Satisfactory Mod Manager if it is not already installed.';
  const start='In the Satisfactory in-game chat, run /frm http start. ';
  const auto='Enable the FRM web-server Autostart setting in the Satisfactory mod options. ';
  const suffix=config.port&&config.port!==port?'Detected configured port '+config.port+'. ':'';
  return 'The FRM HTTP service is not responding. '+start+auto+suffix+install;
}
async function probeFRM(port,fetcher=fetch,timeoutMs=1500){
  try{
    const response=await fetcher('http://127.0.0.1:'+port+'/getWorldInv',
      {signal:AbortSignal.timeout(timeoutMs)});
    if(response.status===401||response.status===403)return {ok:false,kind:'unauthorized'};
    if(!response.ok)return {ok:false,kind:'wrong-service'};
    const world=await response.json();
    if(!Array.isArray(world))return {ok:false,kind:'incompatible'};
    return {ok:true,port,world};
  }catch{return {ok:false,kind:'unavailable'};}
}
async function findFRM(requestedPort,{manual=false,config=null,probe=probeFRM}={}){
  const settings=config||await readFRMConfig();
  const ports=candidatePorts(requestedPort,settings.port,manual);
  let firstFailure=null;
  for(const port of ports){
    const result=await probe(port);
    if(result.ok)return {ok:true,port,world:result.world,config:settings,attempted:ports};
    if(!firstFailure||result.kind!=='unavailable')firstFailure={...result,port};
  }
  const kind=firstFailure?.kind||'unavailable';
  return {ok:false,code:kind,port:requestedPort,config:settings,attempted:ports,
    message:helpfulMessage(kind,settings,firstFailure?.port||requestedPort)};
}
module.exports={extractFRMConfig,settingsPath,readFRMConfig,candidatePorts,helpfulMessage,probeFRM,findFRM};
