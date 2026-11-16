'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {safeSession,safeBase}=require('../src/blueprints');
test('blocks directory traversal and forbidden session names',()=>{
  for(const bad of ['','..','../other','foo/bar','foo\\bar','bad:name','trailing.'])
    assert.throws(()=>safeSession(bad));
  assert.equal(safeSession('Mega Factory'),'Mega Factory');
});
test('sanitizes blueprint names',()=>{
  assert.equal(safeBase('My Build.sbp'),'My Build');
  assert.equal(safeBase('bad:name.sbpcfg'),'bad_name');
});
