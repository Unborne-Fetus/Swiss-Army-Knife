'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sortItems}=require('../src/ui/sort');
const {cleanClassName,makeIconLoader}=require('../src/icons');
const {TOOL_URLS,allowedToolUrl,clampBounds}=require('../src/embedded-tools-urls');
test('numeric and alphabetic sorting with empty rates last',()=>{
  const rows=[
    {name:'Zinc',total:4,net:null},
    {name:'Iron Plate',total:200,net:4},
    {name:'Iron Rod',total:50,net:-2}
  ];
  assert.deepEqual(sortItems(rows,'name','asc').map(x=>x.name),['Iron Plate','Iron Rod','Zinc']);
  assert.deepEqual(sortItems(rows,'total','desc').map(x=>x.total),[200,50,4]);
  assert.deepEqual(sortItems(rows,'net','asc').map(x=>x.net),[-2,4,null]);
});
test('only valid class IDs may be used as image paths',()=>{
  assert.equal(cleanClassName('Desc_IronPlate_C'),'Desc_IronPlate_C');
  for(const invalid of ['../Icons/foo','a/b','http://localhost','Space Thing',''])assert.equal(cleanClassName(invalid),null);
});
test('image loader accepts only PNG bytes and caches successful fetches',async()=>{
  let calls=0;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(40)]);
  const loader=makeIconLoader(async(url)=>{
    calls++;assert.ok(url.endsWith('/Icons/Desc_IronPlate_C.png'));
    return {ok:true,headers:{get:()=>null},arrayBuffer:async()=>png};
  });
  assert.ok((await loader.get(8080,'Desc_IronPlate_C')).startsWith('data:image/png;base64,'));
  await loader.get(8080,'Desc_IronPlate_C');assert.equal(calls,1);
});
test('embed URLs cannot send user to unsafe origins',()=>{
  assert.ok(TOOL_URLS.map.includes('interactive-map'));
  assert.ok(allowedToolUrl(TOOL_URLS.power));
  assert.equal(allowedToolUrl('https://satisfactory-calculator.com.evil.test/en/interactive-map'),false);
  assert.equal(allowedToolUrl('javascript:alert(1)'),false);
  assert.deepEqual(clampBounds({x:-2,y:4,width:10000,height:50},[100,200]),{x:0,y:4,width:100,height:50});
});
