import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareProfiles,coverageOf} from '../dist/compare.mjs';
const obs=(state,value)=>state==='value'?{state,value,evidence:[]}:{state,evidence:[]};
const value=v=>obs('value',v);
const snapshot=({entries={},fields={},guid='same',build='1',name='Ett'}={})=>({schemaVersion:1,snapshotId:`${guid}-${build}`,characterGUID:guid,capturedAt:1,addonVersion:'0.3.0',client:{build,locale:'enUS'},
 sections:{identity:{fields:{name:value(name)},entries:{}},stats:{fields,entries:{}},equipment:{fields:{},entries}}});
const kindOf=(result,key)=>result.rows.find(r=>r.key===key)?.kind;

test('value changes are gameplay, not coverage changes',()=>{
 const a=snapshot({entries:{'5':{fields:{itemID:value(123)}},'6':{fields:{itemID:value(9)}}},fields:{level:value(13),xp:value(0),flag:value(false)}});
 const b=snapshot({entries:{'5':{fields:{itemID:value(456)}},'6':{fields:{itemID:obs('empty')}}},fields:{level:value(14),xp:value(10),flag:value(true)}});
 const result=compareProfiles(a,b);
 assert.equal(result.counts.unchanged,result.rows.length);
});

test('restriction, failure and recovery are reported',()=>{
 const a=snapshot({fields:{health:value(50),power:value(10),xp:obs('error'),mana:obs('restricted'),rested:obs('unavailable')}});
 const b=snapshot({fields:{health:obs('restricted'),power:obs('unavailable'),xp:value(5),mana:value(3),rested:obs('empty')}});
 const result=compareProfiles(a,b);
 assert.equal(kindOf(result,'stats.health'),'becameRestricted');
 assert.equal(kindOf(result,'stats.power'),'becameUnavailable');
 for(const key of ['stats.xp','stats.mana','stats.rested'])assert.equal(kindOf(result,key),'nowAvailable',key);
});

test('fields on one side only are newly captured or not captured, never removed',()=>{
 const a=snapshot({fields:{old:value(1),gone:obs('notCaptured')}}),b=snapshot({fields:{added:value(2),gone:value(3)}});
 const result=compareProfiles(a,b);
 assert.equal(kindOf(result,'stats.old'),'notCapturedAfter');
 assert.equal(kindOf(result,'stats.added'),'newlyCaptured');
 assert.equal(kindOf(result,'stats.gone'),'newlyCaptured');
 assert.ok(result.rows.every(r=>!/remov/i.test(r.kind)));
});

test('a partial result is reported as another state change',()=>{
 const result=compareProfiles(snapshot({fields:{list:value(1)}}),snapshot({fields:{list:obs('partial')}}));
 assert.equal(kindOf(result,'stats.list'),'otherChange');
});

test('collection entries pool per field, so different characters compare by coverage',()=>{
 const a=snapshot({guid:'mage',entries:{'5':{fields:{itemID:value(123)}}}});
 const b=snapshot({guid:'warrior',name:'Brumboldt',entries:{'7':{fields:{itemID:value(456)}},'9':{fields:{itemID:obs('empty')}}}});
 const result=compareProfiles(a,b);
 const row=result.rows.find(r=>r.key==='equipment.*.itemID');
 assert.deepEqual(row.after.states,{value:1,empty:1});
 assert.equal(row.kind,'unchanged');
 assert.equal(result.sameCharacter,false);
 const [coverage]=coverageOf(b).filter(r=>r.key==='equipment.*.itemID');
 assert.equal(coverage.collection,true);assert.deepEqual(coverage.observations.map(o=>o.entry),['7','9']);
});

test('captures from different builds compare, and each side says what it is',()=>{
 const result=compareProfiles(snapshot({build:'1'}),snapshot({build:'2',guid:'other',name:'Lilalx'}));
 assert.equal(result.sameBuild,false);
 assert.deepEqual([result.before.build,result.after.build,result.after.name,result.after.addonVersion],['1','2','Lilalx','0.3.0']);
 assert.throws(()=>compareProfiles({...snapshot(),schemaVersion:2},snapshot()));
});

test('real captures: addon 0.3.0 expands coverage and detects restricted values',()=>{
 const root=new URL('../dist/',import.meta.url);
 const history=JSON.parse(readFileSync(new URL('history.json',root)));
 const [a,b]=history.snapshots.map(s=>JSON.parse(readFileSync(new URL(s.profileFile,root))));
 assert.deepEqual([a.addonVersion,b.addonVersion],['0.2.0','0.3.0']);
 const result=compareProfiles(a,b);
 assert.equal(kindOf(result,'stats.health'),'becameRestricted');
 assert.equal(kindOf(result,'stats.xp'),'unchanged'); // its value changed; its coverage didn't
 assert.equal(kindOf(result,'reputation.enumeratedLineCount'),'nowAvailable');
 assert.ok(result.rows.filter(r=>r.key.startsWith('spells.*.')).every(r=>r.kind==='newlyCaptured'));
 assert.equal(result.counts.notCapturedAfter,0);
});
