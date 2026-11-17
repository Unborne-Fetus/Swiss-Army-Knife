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

test('counts real canceled ad requests and labels filter source',async()=>{
  let active=false;
  const fake={
    isBlockingEnabled:()=>active,
    enableBlockingInSession:()=>{active=true;},
    disableBlockingInSession:()=>{active=false;},
    onBeforeRequest:(_details,cb)=>cb({cancel:true})
  };
  const blocker=makeAdBlock({ses:{},cacheDir:'unused',loadEngine:async()=>({engine:fake,source:'full'})});
  const started=await blocker.setEnabled(true);
  assert.equal(started.source,'full');
  fake.onBeforeRequest({url:'https://ads.example.test/banner.js'},()=>{});
  assert.equal(blocker.status().blockedRequests,1);
  assert.equal(blocker.status().active,true);
});
test('filter startup exceptions are surfaced without reporting protection as active',async()=>{
  let active=false;
  const fake={
    isBlockingEnabled:()=>active,
    enableBlockingInSession:()=>{throw Error('Electron preload blocked');},
    disableBlockingInSession:()=>{active=false;}
  };
  const blocker=makeAdBlock({ses:{},cacheDir:'unused',loadEngine:async()=>fake});
  const status=await blocker.setEnabled(true);
  assert.equal(status.active,false);
  assert.match(status.error,/Filter activation failed/);
});
