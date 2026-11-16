'use strict';

const {fromTelemetry} = require('./inventory');

function validatePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Enter a valid local monitoring port (1–65535).');
  }
  return port;
}

async function endpoint(port, name) {
  // Intentionally confined to loopback; the desktop UI cannot proxy arbitrary hosts.
  const response = await fetch('http://127.0.0.1:' + port + '/' + name, {
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
  return response.json();
}

async function getLiveSnapshot(requestedPort) {
  const port = validatePort(requestedPort || 8080);
  const [worldResult, cloudResult, statsResult, factoryResult] = await Promise.allSettled([
    endpoint(port,'getWorldInv'),
    endpoint(port,'getCloudInv'),
    endpoint(port,'getProdStats'),
    endpoint(port,'getFactory')
  ]);
  if (worldResult.status === 'rejected') {
    throw new Error('Cannot reach Ficsit Remote Monitoring on localhost:' + port +
      '. Start Satisfactory with the FRM mod and enable its HTTP service.');
  }
  const world = worldResult.value;
  if (!Array.isArray(world)) throw new Error('FRM returned an invalid world inventory response.');
  const cloud = cloudResult.status === 'fulfilled' && Array.isArray(cloudResult.value) ? cloudResult.value : [];
  const stats = statsResult.status === 'fulfilled' && Array.isArray(statsResult.value) ? statsResult.value : null;
  const factory = factoryResult.status === 'fulfilled' && Array.isArray(factoryResult.value) ? factoryResult.value : null;
  const normalized = fromTelemetry(world,cloud,stats,factory);
  return {
    mode:'live',items:normalized.items,rateSource:normalized.rateSource,
    capturedAt: new Date().toISOString(),
    warnings:[
      cloudResult.status === 'rejected' ? 'Dimensional Depot inventory unavailable.' : '',
      normalized.rateSource === 'unavailable' ? 'Production rate endpoints unavailable (Production Stats / getFactory).' : ''
    ].filter(Boolean)
  };
}
module.exports = {getLiveSnapshot,validatePort};
