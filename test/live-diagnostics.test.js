'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {extractFRMConfig,candidatePorts,probeFRM,findFRM,helpfulMessage}=require('../src/live-diagnostics');
test('recognizes FGUserSettings FRM port and autostart',()=>{
  const cfg=extractFRMConfig('[FicsitRemoteMonitoring]\nFicsitRemoteMonitoring.uWS.Port=(mStringValue="8123")\nFicsitRemoteMonitoring.uWS.Autostart=(mIntValue=1)');
  assert.deepEqual(cfg,{detected:true,port:8123,autostart:true});
});
test('port candidates favor chosen port and discovered config',()=>{
  assert.deepEqual(candidatePorts(8090,8123).slice(0,3),[8090,8123,8080]);
  assert.deepEqual(candidatePorts(8123,8080,true),[8123]);
});
test('successful inventory probe accepts empty factory inventories',async()=>{
  const found=await probeFRM(8123,async(url)=>({
    ok:true,status:200,json:async()=>[]
  }));
  assert.ok(found.ok);assert.deepEqual(found.world,[]);
});
test('auto detection tries configured port after default and returns it',async()=>{
  const tried=[];
  const result=await findFRM(8080,{config:{detected:true,port:8123,autostart:false},probe:async port=>{
    tried.push(port);
    return port===8123?{ok:true,world:[{Name:'Iron',Amount:14}]}:{ok:false,kind:'unavailable'};
  }});
  assert.equal(result.port,8123);
  assert.deepEqual(tried,[8080,8123]);
});
test('failed connection describes in-game enable command, not just localhost exception',async()=>{
  const result=await findFRM(8080,{config:{port:null,detected:false,autostart:null},
    probe:async()=>({ok:false,kind:'unavailable'})});
  assert.equal(result.ok,false);
  assert.match(result.message,/\/frm http start/);
  assert.match(result.message,/Satisfactory Mod Manager/);
  assert.match(helpfulMessage('wrong-service',{},8080),/different service/);
});
