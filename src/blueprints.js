'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const AdmZip = require('adm-zip');

const MAX_BLUEPRINT_BYTES = 40 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 75 * 1024 * 1024;

function blueprintRoot() {
  return path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || '', 'AppData','Local'),
    'FactoryGame','Saved','SaveGames','blueprints');
}
function safeSession(name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
      name === '.' || name === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
      name.endsWith('.') || name.endsWith(' ')) {
    throw new Error('Session name must be a valid single Windows folder name.');
  }
  return name.trim();
}
function safeBase(name) {
  const base = path.basename(String(name)).replace(/\.(sbp|sbpcfg)$/i,'')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,90);
  if (!base || base === '.' || base === '..') throw new Error('Invalid blueprint filename.');
  return base;
}
async function listSessions() {
  const root = blueprintRoot();
  try {
    const entries = await fs.readdir(root,{withFileTypes:true});
    return entries.filter(e=>e.isDirectory() && !e.isSymbolicLink()).map(e=>e.name).sort();
  } catch(error) {
    if(error.code === 'ENOENT') return [];
    throw error;
  }
}
async function listInstalled(session) {
  const dir = path.join(blueprintRoot(),safeSession(session));
  try {
    const files = await fs.readdir(dir,{withFileTypes:true});
    return files.filter(f=>f.isFile() && f.name.toLowerCase().endsWith('.sbp'))
      .map(f=>f.name).sort();
  } catch(error) {if(error.code === 'ENOENT') return []; throw error;}
}
async function extractFiles(paths) {
  const entries = [];
  let total=0;
  function pushFile(name, bytes) {
    const ext = path.extname(name).toLowerCase();
    if (ext !== '.sbp' && ext !== '.sbpcfg') return;
    const data=Buffer.from(bytes);
    total+=data.length;
    if(data.length===0 || data.length > MAX_BLUEPRINT_BYTES || total>MAX_ARCHIVE_BYTES)
      throw new Error('Blueprint exceeds the safe size limit.');
    entries.push({base:safeBase(name),ext,bytes:data});
  }
  for (const filePath of paths) {
    const stats=await fs.stat(filePath);
    if (!stats.isFile() || stats.size>MAX_ARCHIVE_BYTES)
      throw new Error('Invalid or oversized download.');
    if (path.extname(filePath).toLowerCase()==='.zip') {
      const zip=new AdmZip(filePath);
      for(const entry of zip.getEntries()) {
        if(entry.isDirectory) continue;
        const ext=path.extname(entry.entryName).toLowerCase();
        if(ext!=='.sbp' && ext!=='.sbpcfg') continue;
        // Check metadata BEFORE decompressing a zip entry.
        if(entry.header.size>MAX_BLUEPRINT_BYTES || total + entry.header.size >MAX_ARCHIVE_BYTES)
          throw new Error('ZIP contains oversized blueprint content.');
        pushFile(path.basename(entry.entryName),entry.getData());
      }
    } else {
      const ext=path.extname(filePath).toLowerCase();
      if(ext!=='.sbp' && ext!=='.sbpcfg') throw new Error('Only .sbp, .sbpcfg and .zip are accepted.');
      pushFile(path.basename(filePath),await fs.readFile(filePath));
    }
  }
  if(!entries.length) throw new Error('No supported blueprint files were found.');
  return entries;
}
async function installBlueprints(session, paths) {
  safeSession(session);
  if (!Array.isArray(paths) || !paths.length) throw new Error('Choose blueprint files to install.');
  const dir=path.join(blueprintRoot(),session.trim());
  await fs.mkdir(dir,{recursive:true});
  const entries=await extractFiles(paths);
  const groups=new Map();
  for(const entry of entries) {
    if(!groups.has(entry.base)) groups.set(entry.base,{});
    groups.get(entry.base)[entry.ext]=entry.bytes;
  }
  const installed=[];
  for(const [base,group] of groups) {
    // Config files alone may complement an .sbp that was previously installed.
    if(!group['.sbp']) {
      const exists=await fs.stat(path.join(dir,base+'.sbp')).then(()=>true,()=>false);
      if(!exists || !group['.sbpcfg']) continue;
      try { await fs.writeFile(path.join(dir,base+'.sbpcfg'),group['.sbpcfg'],{flag:'wx'}); installed.push(base+'.sbpcfg'); }
      catch(e){if(e.code!=='EEXIST') throw e;}
      continue;
    }
    let name=base;
    let count=2;
    while(await fs.stat(path.join(dir,name+'.sbp')).then(()=>true,()=>false)) {
      name=base+' ('+(count++)+')';
    }
    await fs.writeFile(path.join(dir,name+'.sbp'),group['.sbp'],{flag:'wx'});
    if(group['.sbpcfg']) await fs.writeFile(path.join(dir,name+'.sbpcfg'),group['.sbpcfg'],{flag:'wx'});
    installed.push(name+'.sbp');
  }
  if (!installed.length) throw new Error('No new blueprints to install (or config had no matching .sbp).');
  return {session,installed,directory:dir};
}
module.exports = {safeSession,safeBase,blueprintRoot,listSessions,listInstalled,installBlueprints};
