'use strict';

const fs = require('node:fs/promises');
const {listSaves,loadSaveSnapshot,readSaveHeader} = require('./saves');
const {safeSession} = require('./blueprints');

function matchSessionName(header) {
  try { return safeSession(header && header.sessionName); }
  catch { return null; }
}
function estimateSaveDelta(previous, current, minutes) {
  if (!previous || !current || previous.session !== current.session ||
      !Number.isFinite(minutes) || minutes < 0.25 || minutes > 1440) return current;
  const before = new Map(previous.items.map(item=>[item.id,item.total]));
  const after = new Map(current.items.map(item=>[item.id,item.total]));
  const ids = new Set([...before.keys(),...after.keys()]);
  const byId = new Map(current.items.map(item=>[item.id,{...item}]));
  for (const id of ids) {
    if (!byId.has(id)) {
      // Items entirely removed from the inventory still have a measurable net change.
      const original = previous.items.find(item=>item.id===id);
      byId.set(id,{...original,stored:0,cloud:0,total:0});
    }
    byId.get(id).net = Math.round((((after.get(id)||0)-(before.get(id)||0))/minutes)*10)/10;
  }
  return {
    ...current,
    items:[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    rateSource:'save-delta',
    warnings:[...current.warnings,
      'Net / min is an estimate of inventory CHANGE between two saves, not gross factory throughput.']
  };
}

class AutoDiscovery {
  constructor(dependencies={}) {
    this.deps={
      list:dependencies.list || listSaves,
      header:dependencies.header || readSaveHeader,
      load:dependencies.load || loadSaveSnapshot
    };
    this.latest=null;
    this.snapshot=null;
    this.inFlight=null;
    this.error=null;
  }
  async scan() {
    if(this.inFlight) return this.inFlight;
    this.inFlight=this.performScan().finally(()=>{this.inFlight=null;});
    return this.inFlight;
  }
  async performScan() {
    const files=await this.deps.list();
    if(!files.length) {
      this.latest=null;this.snapshot=null;this.error=null;
      return {latest:null,snapshot:null,error:null,changed:false};
    }
    // Read headers in most-recent-first order, never guess the blueprint session
    // from a filename (manual save names can be completely unrelated).
    let chosen=null,lastError=null;
    for(const file of files.slice(0,12)) {
      try {
        const header=await this.deps.header(file.path);
        const session=matchSessionName(header);
        if(session){chosen={...file,session};break;}
      }catch(error){lastError=error;}
    }
    if(!chosen) {
      this.error=lastError?String(lastError.message||lastError):
        'No supported Satisfactory session name was found in the save headers.';
      return {latest:this.latest,snapshot:this.snapshot,error:this.error,changed:false};
    }
    const same=this.latest && this.latest.path===chosen.path &&
      this.latest.modifiedAt===chosen.modifiedAt && this.latest.bytes===chosen.bytes;
    if(same) return {latest:chosen,snapshot:null,error:this.error,changed:false};

    // Saving may still be in progress; the next automatic scan retries.
    if(Date.now()-Date.parse(chosen.modifiedAt)<1500)
      return {latest:this.latest,snapshot:null,error:null,changed:false};
    try {
      const parsed=await this.deps.load(chosen.path);
      const snapshot={...parsed,session:chosen.session};
      const previous=this.snapshot;
      const prevMeta=this.latest;
      const minutes=prevMeta?(Date.parse(chosen.modifiedAt)-Date.parse(prevMeta.modifiedAt))/60000:0;
      const normalized=estimateSaveDelta(previous,snapshot,minutes);
      this.latest=chosen;
      this.snapshot=normalized;
      this.error=null;
      return {latest:chosen,snapshot:normalized,error:null,changed:true};
    }catch(error) {
      this.error='Could not parse latest save: '+(error.message||error);
      // Never set "latest" after a parse failure so the next scan retries.
      return {latest:this.latest,snapshot:null,error:this.error,changed:false};
    }
  }
}
module.exports={AutoDiscovery,matchSessionName,estimateSaveDelta};
