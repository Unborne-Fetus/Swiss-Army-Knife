'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fromTelemetry,extractSaveInventory}=require('../src/inventory');

test('aggregates storage, cloud and production without double-counting',()=>{
  const got=fromTelemetry(
    [{Name:'Iron Plate',ClassName:'Desc_IronPlate_C',Amount:120},
     {Name:'Iron Plate',ClassName:'Desc_IronPlate_C',Amount:80}],
    [{Name:'Iron Plate',ClassName:'Desc_IronPlate_C',Amount:40}],
    [{Name:'Iron Plate',ClassName:'Desc_IronPlate_C',CurrentProd:60,CurrentConsumed:12}],
    null);
  assert.equal(got.rateSource,'production-stats');
  assert.deepEqual([got.items[0].stored,got.items[0].cloud,got.items[0].total],[200,40,240]);
  assert.deepEqual([got.items[0].produced,got.items[0].consumed,got.items[0].net],[60,12,48]);
});
test('falls back to per-machine production without a Production Stats mod',()=>{
  const got=fromTelemetry([],[],null,[{production:[{ClassName:'Desc_Rotor_C',CurrentProd:4}],
    ingredients:[{ClassName:'Desc_IronRod_C',CurrentConsumed:20}]}]);
  assert.equal(got.rateSource,'factory');
  assert.equal(got.items.find(x=>x.id==='Desc_Rotor_C').produced,4);
  assert.equal(got.items.find(x=>x.id==='Desc_IronRod_C').net,-20);
});
test('does not fabricate rates for an offline save',()=>{
  const save={levels:[{objects:[{properties:{mInventoryStacks:{values:[{value:{properties:{
    Item:{itemReference:{pathName:'/Game/Parts/Desc_Cable.Desc_Cable_C'}},
    NumItems:{value:65}
  }}}]}}}]}]};
  const got=extractSaveInventory(save);
  assert.equal(got.items[0].total,65);
  assert.equal(got.items[0].net,null);
  assert.equal(got.components,1);
});

test('reads inventory from parser keyed levels (not only arrays)',()=>{
  const save={levels:{Persistent_Level:{objects:[{
    properties:{mInventoryStacks:{values:[{value:{properties:{
      Item:{value:{itemReference:{pathName:'/Game/Factory/Desc_IronPlate.Desc_IronPlate_C'}}},
      NumItems:{value:250}
    }}}]}}
  }]}}};
  const parsed=extractSaveInventory(save);
  assert.equal(parsed.components,1);
  assert.equal(parsed.stacksRead,1);
  assert.equal(parsed.items[0].total,250);
});
