'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Script}=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'src/ui/index.html'),'utf8');
const source=fs.readFileSync(path.join(ROOT,'src/ui/app.js'),'utf8');

test('first page is live only and has sortable item columns',()=>{
  const first=html.split('id="tab-dashboard">')[1].split('id="tab-map">')[0];
  assert.ok(first.includes('LIVE FACTORY INTELLIGENCE'));
  assert.ok(!first.includes('.sav'));
  assert.ok(!first.includes('saveSelect'));
  for(const column of ['name','stored','cloud','total','produced','consumed','net'])
    assert.ok(first.includes('data-sort="'+column+'"'));
  assert.ok(html.includes('<script src="./sort.js"'));
});
test('map and Satisfactory Calculator planners have integrated workspaces',()=>{
  for(const tool of ['map','production','power']){
    assert.ok(html.includes('id="tab-'+tool+'"'));
    assert.ok(html.includes('id="toolView-'+tool+'"'));
    assert.ok(html.includes('data-reload-tool="'+tool+'"'));
  }
});
test('renderer scripts have valid JavaScript syntax',()=>{
  for(const f of ['src/ui/app.js','src/ui/sort.js']){
    assert.doesNotThrow(()=>new Script(fs.readFileSync(path.join(ROOT,f),'utf8'),{filename:f}));
  }
});
test('renderer DOM lookups refer to present control ids',()=>{
  const ids=[...source.matchAll(/el\('([^']+)'\)/g)].map(match=>match[1]);
  for(const id of ids) assert.ok(html.includes('id="'+id+'"'),'Missing html id: '+id);
});
