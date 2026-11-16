'use strict';
const el=id=>document.getElementById(id);
const state={tab:'dashboard',mode:'none',port:8080,snapshot:null,session:'',busy:false,lastSave:''};
const fmt=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const amount=n=>n===null || n===undefined?'—':fmt.format(n);
const signed=n=>n===null || n===undefined?'—':(n>0?'+':'')+fmt.format(n);
function toast(message,isError=false){
  const box=el('toast');box.textContent=message;box.classList.toggle('error',isError);
  box.classList.add('visible');clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>box.classList.remove('visible'),6500);
}
async function action(fn){try{await fn();}catch(error){toast(error.message||String(error),true);}}
function switchTab(tab){
  state.tab=tab;for(const button of document.querySelectorAll('[data-tab]'))
    button.classList.toggle('active',button.dataset.tab===tab);
  for(const view of document.querySelectorAll('.view'))
    view.classList.toggle('current',view.id==='tab-'+tab);
  el('crumb').textContent=tab==='dashboard'?'FACTORY DASHBOARD':tab==='map'?'INTERACTIVE MAP':'BLUEPRINT MANAGER';
}
function setOnline(mode){
  state.mode=mode;el('connectionDot').classList.toggle('online',mode==='live');
  el('connectionText').textContent=mode==='live'?'Live monitoring connected':mode==='save'?'Offline save loaded':'Not connected';
  el('connectBtn').textContent=mode==='live'?'Reconnect live':'Connect live';
}
function makeCell(text,className=''){
  const td=document.createElement('td');td.className=className;td.textContent=text;return td;
}
function renderTable(){
  const body=el('itemRows');body.replaceChildren();
  const items=(state.snapshot&&state.snapshot.items)||[];
  const search=el('itemSearch').value.toLowerCase().trim();
  const filtered=items.filter(i=>i.name.toLowerCase().includes(search)||i.id.toLowerCase().includes(search));
  if(!filtered.length){
    const tr=document.createElement('tr'),td=makeCell(items.length?'No matching materials.':'No materials detected.','empty');
    td.colSpan=7;tr.append(td);body.append(tr);return;
  }
  for(const item of filtered){
    const row=document.createElement('tr');
    row.append(makeCell(item.name,'item-name'),makeCell(amount(item.stored),'numeric'),
      makeCell(state.mode==='live'?amount(item.cloud):'—','numeric'),
      makeCell(amount(item.total),'numeric accent'),makeCell(amount(item.produced),'numeric'),
      makeCell(amount(item.consumed),'numeric'),makeCell(signed(item.net),'numeric '+(item.net>0?'positive':item.net<0?'negative':'')));
    body.append(row);
  }
}
function renderSnapshot(snapshot){
  state.snapshot=snapshot;setOnline(snapshot.mode);
  const items=snapshot.items||[],hasRates=snapshot.rateSource!=='unavailable';
  el('snapshotTitle').textContent=snapshot.mode==='live'?'Live factory overview':(snapshot.name||'Offline save')+' overview';
  el('snapshotSubtitle').textContent=(snapshot.mode==='live'?'Live telemetry · ':'Save snapshot · ')+
    new Date(snapshot.capturedAt).toLocaleString()+
    (hasRates?' · Rates from '+(snapshot.rateSource==='factory'?'factory machines':'Production Stats'):' · Rates unavailable');
  el('metricTypes').textContent=amount(items.length);
  el('metricItems').textContent=amount(items.reduce((v,i)=>v+i.total,0));
  el('metricProd').textContent=hasRates?amount(items.reduce((v,i)=>v+(i.produced||0),0)):'—';
  el('metricCons').textContent=hasRates?amount(items.reduce((v,i)=>v+(i.consumed||0),0)):'—';
  el('sourceNote').textContent=(snapshot.warnings||[]).join(' ')||
    'Live storage totals exclude belts, pipes and factory input inventories. Rates are separate measures of throughput.';
  renderTable();
}
async function refreshSaves(){
  const files=await window.sak.saves(),select=el('saveSelect');select.replaceChildren();
  if(!files.length)select.add(new Option('No local saves found — browse manually',''));
  else for(const f of files)select.add(new Option(f.name+' · '+new Date(f.modifiedAt).toLocaleDateString(),f.path));
  if(state.lastSave&&files.some(f=>f.path===state.lastSave))select.value=state.lastSave;
  return files;
}
async function loadSelectedSave(){
  const file=el('saveSelect').value;
  if(!file){toast('Choose a save or use the browse button.',true);return;}
  const snapshot=await window.sak.loadSave(file);state.lastSave=file;
  renderSnapshot(snapshot);toast('Loaded '+snapshot.name);
}
async function readLive(silent=false){
  if(state.busy)return;
  state.busy=true;
  try{
    const port=Number(el('port').value),snapshot=await window.sak.live(port);
    state.port=port;await window.sak.savePort(port);renderSnapshot(snapshot);
    if(!silent)toast('Connected to local factory telemetry.');
  }catch(error){
    if(!silent)toast(error.message,true);
    if(state.mode==='live')setOnline('none');
  }finally{state.busy=false;}
}
async function refreshCurrent(){
  if(state.mode==='live')return readLive();
  if(state.mode==='save'&&state.lastSave){
    const snapshot=await window.sak.loadSave(state.lastSave);return renderSnapshot(snapshot);
  }
  return refreshSaves();
}
async function refreshSessions(){
  const sessions=await window.sak.sessions(),select=el('sessionSelect');select.replaceChildren();
  select.add(new Option('Choose a session…',''));
  for(const name of sessions)select.add(new Option(name,name));
  if(state.session&&sessions.includes(state.session))select.value=state.session;
}
async function chooseSession(name){
  if(!name)throw new Error('Enter or choose a session name.');
  const data=await window.sak.selectSession(name);state.session=data.session;
  el('currentSession').textContent='Session: '+state.session;el('newSession').value='';
  await refreshSessions();renderInstalled(data.installed);toast('Target session set to '+state.session);
}
function renderInstalled(files){
  const target=el('installedList');target.replaceChildren();
  if(!files.length){
    const empty=document.createElement('div');empty.className='empty';
    empty.textContent='No blueprints installed in this session.';target.append(empty);return;
  }
  for(const file of files){
    const row=document.createElement('div');row.className='installed-row';
    const icon=document.createElement('span');icon.className='blueprint-icon';icon.textContent='▤';
    const text=document.createElement('span');text.textContent=file;row.append(icon,text);target.append(row);
  }
}
async function updateInstalled(){if(state.session)renderInstalled(await window.sak.installed());}
document.querySelectorAll('[data-tab]').forEach(button=>
  button.addEventListener('click',()=>switchTab(button.dataset.tab)));
el('connectBtn').addEventListener('click',()=>action(()=>readLive()));
el('loadSaveBtn').addEventListener('click',()=>action(loadSelectedSave));
el('chooseSaveBtn').addEventListener('click',()=>action(async()=>{
  const snapshot=await window.sak.chooseSave();
  if(snapshot){state.lastSave='';renderSnapshot(snapshot);toast('Loaded '+snapshot.name);}
}));
el('refreshBtn').addEventListener('click',()=>action(refreshCurrent));
el('itemSearch').addEventListener('input',renderTable);
el('openMapBtn').addEventListener('click',()=>action(()=>window.sak.openSite('map')));
el('mapExternalBtn').addEventListener('click',()=>action(()=>window.sak.openSiteExternally('map')));
el('browseBlueprintsBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw new Error('Choose a session first for one-click installation.');
  await window.sak.openSite('blueprints');
}));
el('selectSessionBtn').addEventListener('click',()=>action(()=>chooseSession(el('sessionSelect').value)));
el('createSessionBtn').addEventListener('click',()=>action(()=>chooseSession(el('newSession').value.trim())));
el('importBlueprintsBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw new Error('Choose a session first.');
  const result=await window.sak.importBlueprints();
  if(result){await updateInstalled();toast('Installed '+result.installed.length+' blueprint file(s). Reload your game save.');}
}));
el('openFolderBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw new Error('Choose a session first.');
  const message=await window.sak.openBlueprintFolder();if(message)throw new Error(message);
}));
window.sak.onNotice(payload=>{
  toast(payload.message,payload.isError);
  if(!payload.isError)updateInstalled().catch(()=>{});
});
async function initialize(){
  const settings=await window.sak.settings();state.port=settings.port||8080;
  state.session=settings.session||'';el('port').value=state.port;
  await Promise.all([refreshSessions(),refreshSaves()]);
  if(state.session){el('currentSession').textContent='Session: '+state.session;await updateInstalled();}
  const latest=el('saveSelect').value;await readLive(true);
  if(state.mode!=='live'&&latest){
    await action(async()=>{const snapshot=await window.sak.loadSave(latest);
      state.lastSave=latest;renderSnapshot(snapshot);});
  }
}
setInterval(()=>{if(state.mode==='live'&&!document.hidden)readLive(true).catch(()=>{});},10000);
initialize().catch(error=>toast(error.message,true));
