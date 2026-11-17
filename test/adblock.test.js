'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeAdBlock}=require('../src/adblock');
test('native blocking engine can be enabled and disabled without Chrome extensions',async()=>{
  let active=false;
  const fake={isBlockingEnabled:()=>active,enableBlockingInSession:()=>{active=true;},disableBlockingInSession:()=>{active=false;}};
  const blocker=makeAdBlock({ses:{},cacheDir:'unused',loadEngine:async()=>fake});
  assert.equal((await blocker.setEnabled(true)).active,true);
  assert.equal((await blocker.setEnabled(false)).active,false);
});
test('missing filters do not crash the game companion',async()=>{
  const blocker=makeAdBlock({ses:{},cacheDir:'unused',loadEngine:async()=>{throw Error('offline');}});
  const value=await blocker.setEnabled(true);
  assert.equal(value.active,false);assert.match(value.error,/offline/);
});
