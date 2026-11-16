'use strict';
(function(root){
  const FIELDS=new Set(['name','stored','cloud','total','produced','consumed','net']);
  function sortItems(items,field='name',direction='asc'){
    const key=FIELDS.has(field)?field:'name';
    const sign=direction==='desc'?-1:1;
    return [...items].sort((a,b)=>{
      const x=a[key],y=b[key];
      if(x==null&&y==null)return String(a.name).localeCompare(String(b.name));
      if(x==null)return 1;
      if(y==null)return -1;
      const comparison=key==='name'
        ?String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'})
        :Number(x)-Number(y);
      return comparison*sign||String(a.name).localeCompare(String(b.name));
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={sortItems,FIELDS};
  root.SAKSort={sortItems};
})(typeof window!=='undefined'?window:globalThis);
