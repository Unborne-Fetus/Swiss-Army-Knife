'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {AutoDiscovery,estimateSaveDelta,matchSessionName}=require('../src/autodiscovery');

test('takes session from header, not arbitrary manual save filename',async()=>{
  const scanner=new AutoDiscovery({
    list:async()=>[{path:'C:\\saves\\MySave.sav',name:'MySave.sav',modifiedAt:'2026-01-01T00:00:00.000Z',bytes:123}],
    header:async()=>({sessionName:'The Big Factory'}),
    load:async()=>({mode:'save',items:[{id:'Desc_Cable_C',name:'Cable',total:50,stored:50,cloud:0,net:null}],warnings:[],rateSource:'unavailable'})
  });
  const first=await scanner.scan();
  assert.equal(first.latest.session,'The Big Factory');
  assert.equal(first.snapshot.session,'The Big Factory');
  const second=await scanner.scan();assert.equal(second.changed,false);
  assert.equal(second.snapshot,null);
});
test('invalid session names are not trusted',()=>{
  assert.equal(matchSessionName({sessionName:'../evil'}),null);
  assert.equal(matchSessionName({sessionName:'Factory 1'}),'Factory 1');
});
test('estimated net rate is inventory delta, not machine throughput',()=>{
  const previous={session:'Test',items:[{id:'iron',name:'Iron',total:100,stored:100,cloud:0}]};
  const current={session:'Test',items:[{id:'iron',name:'Iron',total:160,stored:160,cloud:0}],
    warnings:[],rateSource:'unavailable'};
  const delta=estimateSaveDelta(previous,current,5);
  assert.equal(delta.rateSource,'save-delta');
  assert.equal(delta.items[0].net,12);
  assert.equal(estimateSaveDelta(previous,current,0.1).rateSource,'unavailable');
});
test('never applies inventory deltas across different sessions',()=>{
  const old={session:'A',items:[]},recent={session:'B',items:[],warnings:[],rateSource:'unavailable'};
  assert.equal(estimateSaveDelta(old,recent,5),recent);
});
test('a partial save is retried next scan',async()=>{
  let times=0;
  const scanner=new AutoDiscovery({
    list:async()=>[{path:'a.sav',name:'a.sav',modifiedAt:'2026-01-01T00:00:00.000Z',bytes:10}],
    header:async()=>({sessionName:'Factory'}),
    load:async()=>{times++;if(times===1)throw Error('file incomplete');return {mode:'save',items:[],warnings:[],rateSource:'unavailable'};}
  });
  assert.equal((await scanner.scan()).changed,false);
  assert.equal((await scanner.scan()).changed,true);
  assert.equal(times,2);
});
