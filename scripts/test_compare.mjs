import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareProfiles} from '../dist/compare.mjs';
const value=v=>({state:'value',value:v,evidence:[]});
const snapshot=(entries={},fields={})=>({schemaVersion:1,snapshotId:'test',characterGUID:'same',capturedAt:1,client:{build:'1',locale:'enUS'},sections:{stats:{fields,entries:{}},equipment:{fields:{},entries}}});
test('public level, equipment, skill and quest changes are identified',()=>{
 const a=snapshot({'5':{fields:{itemID:value(123)}}},{level:value(13),rank:value(63),questLevel:value(14)});
 const b=snapshot({'5':{fields:{itemID:value(456)}}},{level:value(14),rank:value(64),questLevel:value(15)});
 assert.equal(compareProfiles(a,b).counts.changed,4);
});
test('missing and restricted values never become removals or zeros',()=>{
 const a=snapshot({'5':{fields:{itemID:value(123)}}},{health:value(50),power:{state:'restricted',evidence:[]}});
 const b=snapshot({}, {health:{state:'restricted',evidence:[]},power:value(100)});
 const result=compareProfiles(a,b);
 assert.equal(result.counts.changed,0);assert.equal(result.counts.notComparable,2);assert.equal(result.counts.newlyObserved,1);
});
test('empty is explicit and distinct from zero and false',()=>{
 const a=snapshot({}, {xp:value(0),flag:value(false),slot:value(1)});
 const b=snapshot({}, {xp:value(0),flag:value(false),slot:{state:'empty',evidence:[]}});
 assert.equal(compareProfiles(a,b).counts.unchanged,2);assert.equal(compareProfiles(a,b).counts.changed,1);
});
test('new collection entries are observations, not learning claims',()=>{
 const a=snapshot(),b=snapshot({'1':{fields:{spellID:value(116)}}});
 assert.equal(compareProfiles(a,b).counts.changed,0);assert.equal(compareProfiles(a,b).counts.newlyObserved,1);
});
test('different characters and reverse chronology are rejected; build differences suppress changes',()=>{
 const a=snapshot({}, {xp:value(1)}),b=snapshot({}, {xp:value(2)});
 b.characterGUID='other';assert.throws(()=>compareProfiles(a,b));b.characterGUID='same';
 b.capturedAt=0;assert.throws(()=>compareProfiles(a,b));b.capturedAt=1;b.client.build='2';
 assert.equal(compareProfiles(a,b).counts.changed,0);assert.equal(compareProfiles(a,b).counts.notComparable,1);
});
test('real captures distinguish expanded spell coverage and missing quests from gameplay changes',()=>{
 const root=new URL('../dist/',import.meta.url);
 const history=JSON.parse(readFileSync(new URL('history.json',root)));
 const [a,b]=history.snapshots.map(s=>JSON.parse(readFileSync(new URL(s.profileFile,root))));
 const result=compareProfiles(a,b);
 assert.equal(result.rows.find(r=>r.path==='stats.xp').before.value,9493);
 assert.equal(result.rows.find(r=>r.path==='stats.xp').after.value,10843);
 assert.equal(result.rows.filter(r=>r.path.startsWith('spells.')&&r.kind==='changed').length,0);
 const missingQuests=result.rows.filter(r=>r.path.startsWith('quests.')&&r.after.state==='notCaptured');
 assert.ok(missingQuests.length>0);assert.ok(missingQuests.every(r=>r.kind==='notComparable'));
});
