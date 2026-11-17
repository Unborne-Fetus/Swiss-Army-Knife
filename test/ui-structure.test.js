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
  for(const f of ['src/ui/app.js','src/ui/sort.js','src/main.js','src/preload.js',
    'src/adblock.js','src/live-diagnostics.js','src/telemetry.js','src/embedded-tools.js']){
    assert.doesNotThrow(()=>new Script(fs.readFileSync(path.join(ROOT,f),'utf8'),{filename:f}));
  }
});
test('renderer DOM lookups refer to present control ids',()=>{
  const ids=[...source.matchAll(/el\('([^']+)'\)/g)].map(match=>match[1]);
  for(const id of ids) assert.ok(html.includes('id="'+id+'"'),'Missing html id: '+id);
});

test('Electron main/renderer IPC contract: live and ad blocker handlers must exist',()=>{
  const main=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
  const preload=fs.readFileSync(path.join(ROOT,'src/preload.js'),'utf8');
  for(const channel of ['live:poll','adblock:status','adblock:set','live:automatic','bridge:status']){
    assert.ok(main.includes("ipcMain.handle('"+channel+"'"),
      'Main process is missing '+channel+'; a renderer-only update breaks the application');
  }
  assert.ok(preload.includes("ipcRenderer.invoke('live:poll'"));
  assert.ok(preload.includes("ipcRenderer.invoke('live:read'"),
    'Older running main processes must retain live:read compatibility');
  assert.ok(preload.includes("ipcRenderer.invoke('bridge:status'"));
  assert.ok(source.includes('window.sak.bridgeStatus()'));
  const boot=main.slice(main.indexOf('app.whenReady().then('));
  assert.ok(boot.indexOf('  handlers();')<boot.indexOf('  createMainWindow();'),
    'IPC handlers must register BEFORE the renderer can load');
  assert.ok(main.includes('await ensureProtection();'),
    'Filtering should activate before community pages are loaded');
});
test('version mismatch warning and visible filtering status are present',()=>{
  assert.ok(html.includes('id="coreMismatch"'));
  assert.ok(html.includes('id="coreVersionStatus"'));
  assert.ok(html.includes('id="adBlockingStatus"'));
  assert.ok(html.includes('id="retryProtectionBtn"'));
});
