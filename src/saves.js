'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {extractSaveInventory} = require('./inventory');

function saveRoot() {
  return path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || '', 'AppData','Local'),
    'FactoryGame','Saved','SaveGames');
}

async function listSaves() {
  const root = saveRoot();
  const result = [];
  async function visit(dir, depth) {
    if (depth > 3 || result.length > 500) return;
    let entries;
    try { entries = await fs.readdir(dir,{withFileTypes:true}); }
    catch (error) { if(error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name.toLowerCase() !== 'blueprints') await visit(full,depth+1);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.sav')) {
        const stats = await fs.stat(full);
        result.push({path:full,name:entry.name,modifiedAt:stats.mtime.toISOString(),bytes:stats.size});
      }
    }
  }
  await visit(root,0);
  return result.sort((a,b)=>b.modifiedAt.localeCompare(a.modifiedAt));
}

async function loadSaveSnapshot(filePath) {
  if (typeof filePath !== 'string' || path.extname(filePath).toLowerCase() !== '.sav') {
    throw new Error('Choose a Satisfactory .sav file.');
  }
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('Not a save file.');
  if (stat.size > 1024 * 1024 * 1024) throw new Error('Save is too large (1 GB maximum).');
  const {Parser} = require('@etothepii/satisfactory-file-parser');
  const data = await fs.readFile(filePath);
  const arrayBuffer = Uint8Array.from(data).buffer;
  const save = Parser.ParseSave(path.basename(filePath,'.sav'), arrayBuffer);
  const extracted = extractSaveInventory(save);
  return {
    mode:'save',name:path.basename(filePath),capturedAt:stat.mtime.toISOString(),
    items:extracted.items,rateSource:'unavailable',
    warnings:[
      'Offline quantities are from parsed inventory components (including machines/players); they are not equivalent to FRM storage-only totals.',
      'Rates require live monitoring. Save files do not record real-time production throughput.',
      extracted.components === 0 ? 'No supported inventory components found in this save.' : ''
    ].filter(Boolean),
    stats:{components:extracted.components,stacks:extracted.stacksRead}
  };
}
module.exports = {listSaves,loadSaveSnapshot,saveRoot};
