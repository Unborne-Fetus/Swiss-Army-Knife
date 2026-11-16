'use strict';
const TOOL_URLS=Object.freeze({
  map:'https://satisfactory-calculator.com/en/interactive-map',
  production:'https://satisfactory-calculator.com/en/planners/production',
  power:'https://satisfactory-calculator.com/en/planners/power'
});
function allowedToolUrl(url){
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&(u.hostname==='satisfactory-calculator.com'||u.hostname.endsWith('.satisfactory-calculator.com'));
  }catch{return false;}
}
function clampBounds(rect,contentSize){
  if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('Invalid workspace bounds.');
  const [w,h]=contentSize;
  const x=Math.max(0,Math.min(w-1,Math.floor(rect.x)));
  const y=Math.max(0,Math.min(h-1,Math.floor(rect.y)));
  return {x,y,width:Math.max(1,Math.min(w-x,Math.floor(rect.width))),height:Math.max(1,Math.min(h-y,Math.floor(rect.height)))};
}
module.exports={TOOL_URLS,allowedToolUrl,clampBounds};
