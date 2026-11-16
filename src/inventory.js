'use strict';

/** Normalize the identifiers returned by FRM or extracted from Unreal save references. */
function itemKey(item) {
  const raw = String(item && (item.ClassName || item.className || item.pathName || item.itemName) || '');
  if (!raw) return '';
  return raw.split('/').pop().split('.').pop();
}

function prettyName(id) {
  const raw = String(id || '').replace(/^Desc_/, '').replace(/_C$/, '').replace(/_/g, ' ');
  return raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim() || 'Unknown item';
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * World inventory includes storage containers, NOT belts, pipes or factory inputs.
 * Cloud inventory is separate and is added to the total only once.
 */
function fromTelemetry(world, cloud, stats, factory) {
  const rows = new Map();
  function ensure(entry) {
    const id = itemKey(entry);
    if (!id) return null;
    if (!rows.has(id)) rows.set(id, {
      id, name: entry.Name || prettyName(id),
      stored: 0, cloud: 0, total: 0,
      produced: null, consumed: null, net: null
    });
    const row = rows.get(id);
    if (entry.Name && row.name === prettyName(id)) row.name = entry.Name;
    return row;
  }
  for (const entry of Array.isArray(world) ? world : []) {
    const row = ensure(entry);
    if (row) row.stored += numeric(entry.Amount);
  }
  for (const entry of Array.isArray(cloud) ? cloud : []) {
    const row = ensure(entry);
    if (row) row.cloud += numeric(entry.Amount);
  }

  let rateSource = 'unavailable';
  if (Array.isArray(stats) && stats.length) {
    rateSource = 'production-stats';
    for (const entry of stats) {
      const row = ensure(entry);
      if (!row) continue;
      row.produced = (row.produced || 0) + numeric(entry.CurrentProd);
      row.consumed = (row.consumed || 0) + numeric(entry.CurrentConsumed);
    }
  } else if (Array.isArray(factory)) {
    rateSource = 'factory';
    for (const machine of factory) {
      for (const entry of (Array.isArray(machine.production) ? machine.production : [])) {
        const row = ensure(entry);
        if (row) row.produced = (row.produced || 0) + numeric(entry.CurrentProd);
      }
      for (const entry of (Array.isArray(machine.ingredients) ? machine.ingredients : [])) {
        const row = ensure(entry);
        if (row) row.consumed = (row.consumed || 0) + numeric(entry.CurrentConsumed);
      }
    }
  }
  for (const row of rows.values()) {
    row.total = row.stored + row.cloud;
    if (rateSource !== 'unavailable') {
      row.produced = row.produced || 0;
      row.consumed = row.consumed || 0;
      row.net = row.produced - row.consumed;
    }
  }
  return {items: [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name)), rateSource};
}

function extractSaveInventory(save) {
  const rows = new Map();
  let components = 0;
  let stacksRead = 0;
  for (const level of Array.isArray(save && save.levels) ? save.levels : []) {
    for (const object of Array.isArray(level.objects) ? level.objects : []) {
      const property = object && object.properties && object.properties.mInventoryStacks;
      if (!property) continue;
      const stacks = property.values || property.value;
      if (!Array.isArray(stacks)) continue;
      components++;
      for (const stack of stacks) {
        const properties = (stack && stack.value && stack.value.properties) || (stack && stack.properties) || {};
        const rawItem = properties.Item && (properties.Item.value || properties.Item);
        const reference = rawItem && (rawItem.itemReference || rawItem.itemName || (rawItem.value && rawItem.value.itemReference));
        const id = itemKey(typeof reference === 'string' ? {itemName: reference} : reference);
        const count = numeric(properties.NumItems && (properties.NumItems.value ?? properties.NumItems));
        if (!id || count <= 0 || id.includes('None')) continue;
        stacksRead++;
        rows.set(id, (rows.get(id) || 0) + count);
      }
    }
  }
  return {
    items:[...rows].map(([id,total])=>({
      id,name:prettyName(id),stored:total,cloud:0,total,
      produced:null,consumed:null,net:null
    })).sort((a,b)=>a.name.localeCompare(b.name)),
    components, stacksRead
  };
}
module.exports = {fromTelemetry, extractSaveInventory, prettyName, itemKey};
