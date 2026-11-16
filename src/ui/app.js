'use strict';

const el=id=>document.getElementById(id);
const state={
  tab:'dashboard',port:8080,session:'',mode:'connecting',
  snapshot:null,sortField:'name',sortDirection:'asc',
  busy:false,scanning:false,catalogLoaded:false,
  catalogPage:{isDetail:false,canGoBack:false}
};
const TOOL_TABS=new Set(['map','production','power']);
const fmt=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const num=value=>value==null?'—':fmt.format(value);
const signed=value=>value==null?'—':(value>0?'+':'')+fmt.format(value);
const icons=new Map();
let toastTimer;

function toast(message,error=false){
  const node=el('toast');
  node.textContent=String(message||'Unknown error');
  node.classList.toggle('error',error);
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>node.classList.remove('visible'),6000);
}
async function action(fn){
  try{await fn();}catch(error){toast(error.message||String(error),true);}
}
function setConnection(status,message){
  state.mode=status;
  const connected=status==='live';
  el('connectionDot').classList.toggle('online',connected);
  el('liveDot').classList.toggle('online',connected);
  el('connectionText').textContent=connected?'Live factory connected':'Waiting for live game';
  el('liveTitle').textContent=connected?'Connected to Satisfactory':'Reconnecting automatically';
  el('liveMessage').textContent=message||'Start Satisfactory with Ficsit Remote Monitoring enabled.';
  el('settingsStatus').textContent=connected?
    'Live monitoring connected on port '+state.port+'.':
    'Live monitoring unavailable. Install/enable FRM and start the game. Auto-retry is active.';
}
function setMetrics(items,available){
  const sum=key=>items.reduce((total,item)=>total+(Number(item[key])||0),0);
  el('metricTypes').textContent=available?num(items.length):'—';
  el('metricItems').textContent=available?num(sum('total')):'—';
  const rates=available&&state.snapshot&&state.snapshot.rateSource!=='unavailable';
  el('metricProd').textContent=rates?num(sum('produced')):'—';
  el('metricCons').textContent=rates?num(sum('consumed')):'—';
}
function makeCell(value,klass=''){
  const td=document.createElement('td');td.className=klass;td.textContent=value;return td;
}
function showIcon(slot,source){
  if(!source)return;
  const img=document.createElement('img');
  img.src=source;img.alt='';img.width=30;img.height=30;
  img.decoding='async';img.loading='lazy';
  slot.replaceChildren(img);
}
function requestIcon(item,slot){
  const id=item.id;
  slot.dataset.iconId=id;
  slot.textContent=(item.name||'?').slice(0,1).toUpperCase();
  const cached=icons.get(id);
  if(cached&&cached.data){showIcon(slot,cached.data);return;}
  if(cached&&(cached.loading||Date.now()<cached.retryAt))return;
  const record={loading:true,data:null,retryAt:0};
  icons.set(id,record);
  window.sak.getItemIcon(id).then(data=>{
    record.data=data||null;
    record.retryAt=data?Number.MAX_SAFE_INTEGER:Date.now()+45000;
    record.loading=false;
    if(!data)return;
    for(const box of document.querySelectorAll('[data-icon-id]')){
      if(box.dataset.iconId===id)showIcon(box,data);
    }
  }).catch(()=>{
    record.loading=false;record.retryAt=Date.now()+45000;
  });
}
function renderTable(){
  const tbody=el('itemRows');tbody.replaceChildren();
  const query=el('itemSearch').value.trim().toLowerCase();
  const all=state.snapshot?.items||[];
  const sorted=window.SAKSort.sortItems(
    all.filter(item=>item.name.toLowerCase().includes(query)||item.id.toLowerCase().includes(query)),
    state.sortField,state.sortDirection
  );
  if(!sorted.length){
    const tr=document.createElement('tr');
    const td=makeCell(all.length?'No matching items.':
      state.snapshot?'No inventory items are reported yet.':'Waiting for live inventory data…','empty');
    td.colSpan=7;tr.append(td);tbody.append(tr);
    return;
  }
  for(const item of sorted){
    const tr=document.createElement('tr');
    const name=document.createElement('td');name.className='item-name';
    const line=document.createElement('div');line.className='item-line';
    const icon=document.createElement('span');icon.className='item-icon';
    requestIcon(item,icon);
    const details=document.createElement('span');details.className='item-details';
    const title=document.createElement('strong');title.textContent=item.name;
    const subtitle=document.createElement('small');subtitle.textContent=item.id;
    details.append(title,subtitle);line.append(icon,details);name.append(line);
    tr.append(name,
      makeCell(num(item.stored),'numeric'),
      makeCell(num(item.cloud),'numeric'),
      makeCell(num(item.total),'numeric accent'),
      makeCell(num(item.produced),'numeric'),
      makeCell(num(item.consumed),'numeric'),
      makeCell(signed(item.net),'numeric '+(item.net>0?'positive':item.net<0?'negative':'')));
    tbody.append(tr);
  }
}
function updateSortHeading(){
  for(const button of document.querySelectorAll('[data-sort]')){
    const active=button.dataset.sort===state.sortField;
    button.classList.toggle('active',active);
    button.querySelector('.sort-arrow').textContent=active?(state.sortDirection==='asc'?'↑':'↓'):'';
    button.closest('th').setAttribute('aria-sort',active?
      (state.sortDirection==='asc'?'ascending':'descending'):'none');
  }
}
function selectSort(field){
  if(field===state.sortField){
    state.sortDirection=state.sortDirection==='asc'?'desc':'asc';
  }else{
    state.sortField=field;
    state.sortDirection=field==='name'?'asc':'desc';
  }
  updateSortHeading();renderTable();
}
function renderLive(snapshot){
  state.snapshot=snapshot;
  setConnection('live','Real-time telemetry · Updated '+new Date(snapshot.capturedAt).toLocaleTimeString());
  el('snapshotTitle').textContent='Live factory overview';
  el('snapshotSubtitle').textContent='Last sync: '+new Date(snapshot.capturedAt).toLocaleString()+
    (snapshot.rateSource==='unavailable'?' · Production-rate integration unavailable':' · Production rates available');
  el('syncTag').textContent='LIVE · REFRESH 10 SEC';
  el('sourceNote').textContent=(snapshot.warnings||[]).join(' ')||
    'Totals are storage and dimensional depot counts; production/consumption are the reported per-minute machine rates.';
  setMetrics(snapshot.items||[],true);renderTable();
}
async function readLive(silent=false){
  if(state.busy)return;
  state.busy=true;
  try{
    const snapshot=await window.sak.live(state.port);
    renderLive(snapshot);
    if(!silent)toast('Factory data synchronized.');
  }catch(error){
    const last=state.snapshot;
    setConnection('offline','Satisfactory or FRM is not reachable on localhost:'+state.port+
      '. Checking again automatically every 10 seconds.');
    el('snapshotSubtitle').textContent=last?
      'Connection interrupted · Displayed figures are from the last successful sync.':
      'Start the game with Ficsit Remote Monitoring for live data.';
    el('syncTag').textContent='RECONNECTING';
    if(!silent)toast(error.message||'Cannot connect to game',true);
  }finally{state.busy=false;}
}
async function scanAutomatically(){
  if(state.scanning)return;
  state.scanning=true;
  try{
    const result=await window.sak.autoScan();
    const was=state.session;
    state.session=result.selectedSession||'';
    if(was!==state.session){
      el('currentSession').textContent=state.session?'Session: '+state.session:'No session detected';
      await refreshSessions();
      if(state.session)await updateInstalled();
      refreshCatalogInstallButton();
    }
    el('autoSessionHint').textContent=result.latest?
      'Automatically detected game session: '+result.latest.session:
      'No game session detected yet. Save your world to enable automatic blueprint installation.';
  }finally{state.scanning=false;}
}
function rectFor(id){
  const r=el(id).getBoundingClientRect();
  return {x:r.x,y:r.y,width:r.width,height:r.height};
}
let embeddedTick=0;
async function syncEmbedded(){
  const tab=state.tab;
  const call=++embeddedTick;
  const isCatalog=tab==='blueprints';
  await window.sak.catalogShow(isCatalog,isCatalog?rectFor('catalogView'):null);
  if(call!==embeddedTick)return;
  await window.sak.toolShow(TOOL_TABS.has(tab)?tab:null,
    TOOL_TABS.has(tab)?rectFor('toolView-'+tab):null);
  if(call!==embeddedTick)return;
  if(isCatalog&&!state.catalogLoaded){
    try{await window.sak.catalogOpen();state.catalogLoaded=true;}
    catch(error){toast('Blueprint library unavailable: '+error.message,true);}
  }
}
function switchTab(tab){
  state.tab=tab;
  for(const button of document.querySelectorAll('[data-tab]'))
    button.classList.toggle('active',button.dataset.tab===tab);
  for(const view of document.querySelectorAll('.view'))
    view.classList.toggle('current',view.id==='tab-'+tab);
  const names={dashboard:'FACTORY DASHBOARD',map:'INTERACTIVE MAP',production:'PRODUCTION PLANNER',
    power:'POWER PLANNER',blueprints:'BLUEPRINT MANAGER',settings:'SETTINGS'};
  el('crumb').textContent=names[tab]||'WORKSPACE';
  syncEmbedded().catch(e=>toast(e.message,true));
}
async function refreshSessions(){
  const sessions=await window.sak.sessions();
  const select=el('sessionSelect');select.replaceChildren();
  select.add(new Option('Choose a session…',''));
  for(const session of sessions)select.add(new Option(session,session));
  if(state.session&&sessions.includes(state.session))select.value=state.session;
}
async function chooseSession(name){
  if(!name)throw Error('Enter or choose a session name.');
  const result=await window.sak.selectSession(name);
  state.session=result.session;
  el('currentSession').textContent='Session: '+state.session+' · Manual override';
  el('newSession').value='';
  await refreshSessions();renderInstalled(result.installed);refreshCatalogInstallButton();
  toast('Blueprint destination set to '+state.session);
}
function renderInstalled(files){
  const box=el('installedList');box.replaceChildren();
  if(!files.length){
    const div=document.createElement('div');div.className='empty';
    div.textContent='No blueprints installed in this session.';box.append(div);return;
  }
  for(const file of files){
    const row=document.createElement('div');row.className='installed-row';
    const icon=document.createElement('span');icon.className='blueprint-icon';icon.textContent='▤';
    const name=document.createElement('span');name.textContent=file;
    row.append(icon,name);box.append(row);
  }
}
async function updateInstalled(){
  if(state.session)renderInstalled(await window.sak.installed());
}
function refreshCatalogInstallButton(){
  el('catalogInstall').disabled=!state.catalogPage.isDetail||!state.session;
}
document.querySelectorAll('[data-tab]').forEach(button=>
  button.addEventListener('click',()=>switchTab(button.dataset.tab)));
document.querySelectorAll('[data-sort]').forEach(button=>
  button.addEventListener('click',()=>selectSort(button.dataset.sort)));
el('refreshBtn').addEventListener('click',()=>action(()=>readLive(false)));
el('itemSearch').addEventListener('input',renderTable);
el('savePortBtn').addEventListener('click',()=>action(async()=>{
  const port=Number(el('monitorPort').value);
  await window.sak.savePort(port);state.port=port;
  await readLive(false);
  toast('Connection port saved: '+port);
}));
el('openModInfo').addEventListener('click',()=>action(()=>window.sak.openSiteExternally('mod')));
for(const button of document.querySelectorAll('[data-reload-tool]')){
  button.addEventListener('click',()=>action(()=>window.sak.toolReload(button.dataset.reloadTool)));
}
for(const button of document.querySelectorAll('[data-external-tool]')){
  button.addEventListener('click',()=>action(()=>window.sak.openSiteExternally(button.dataset.externalTool)));
}
el('catalogBack').addEventListener('click',()=>action(()=>window.sak.catalogBack()));
el('catalogHome').addEventListener('click',()=>action(()=>window.sak.catalogHome()));
el('catalogInstall').addEventListener('click',()=>action(async()=>{
  await window.sak.catalogInstall();
  toast('Blueprint download started for '+state.session+'.');
}));
window.sak.onCatalogPage(page=>{state.catalogPage=page;el('catalogBack').disabled=!page.canGoBack;refreshCatalogInstallButton();});
window.sak.onToolStatus(value=>{
  const node=el('toolView-'+value.name);
  if(!node)return;
  if(value.kind==='error')toast(value.name+' cannot load inside the app: '+value.detail,true);
});
function syncPosition(){
  if(state.tab==='blueprints'||TOOL_TABS.has(state.tab))
    syncEmbedded().catch(()=>{});
}
window.addEventListener('resize',syncPosition);
window.addEventListener('scroll',syncPosition,true);
el('browseBlueprintsBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw Error('No blueprint session found; start or save a game first.');
  await window.sak.openSite('blueprints');
}));
el('selectSessionBtn').addEventListener('click',()=>action(()=>chooseSession(el('sessionSelect').value)));
el('autoSessionBtn').addEventListener('click',()=>action(async()=>{
  const result=await window.sak.useActiveSession();
  state.session=result.selectedSession||'';
  await scanAutomatically();
  toast('Automatic session detection enabled.');
}));
el('createSessionBtn').addEventListener('click',()=>action(()=>chooseSession(el('newSession').value.trim())));
el('importBlueprintsBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw Error('Start or save Satisfactory to detect your blueprint session.');
  const result=await window.sak.importBlueprints();
  if(result){await updateInstalled();toast('Installed '+result.installed.length+' blueprint file(s).');}
}));
el('openFolderBtn').addEventListener('click',()=>action(async()=>{
  if(!state.session)throw Error('No blueprint session selected.');
  const error=await window.sak.openBlueprintFolder();
  if(error)throw Error(error);
}));
window.sak.onNotice(payload=>{
  toast(payload.message,payload.isError);
  if(!payload.isError)updateInstalled().catch(()=>{});
});
async function initialize(){
  const settings=await window.sak.settings();
  state.port=settings.port||8080;state.session=settings.session||'';
  el('monitorPort').value=state.port;
  if(state.session){el('currentSession').textContent='Session: '+state.session;await updateInstalled();}
  await Promise.all([readLive(true),refreshSessions(),scanAutomatically()]);
}
updateSortHeading();
initialize().catch(error=>toast(error.message,true));
setInterval(()=>{readLive(true).catch(()=>{});},10000);
setInterval(()=>{scanAutomatically().catch(()=>{});},15000);
