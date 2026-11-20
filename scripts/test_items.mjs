import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemFromLink,readableLinks} from '../dist/items.mjs';

const gloves='|cnIQ1:|Hitem:11192::::::::13:1482::11:::::::|h[Outfitter Gloves]|h|r';

test('reads the item ID and name from a client item link',()=>{
 assert.deepEqual(itemFromLink(gloves),{id:11192,name:'Outfitter Gloves'});
 assert.deepEqual(itemFromLink('|cffffffff|Hitem:6096::::::::14:1482::75|h[Apprentice\'s Shirt]|h|r'),{id:6096,name:'Apprentice\'s Shirt'});
 assert.deepEqual(itemFromLink('|Hitem:2067::|h[Frostbit Staff]|h'),{id:2067,name:'Frostbit Staff'});
});

test('links that differ only in level read the same',()=>{
 assert.deepEqual(itemFromLink(gloves),itemFromLink(gloves.replace('::13:','::14:')));
});

test('anything that is not an item link gives null and passes through unchanged',()=>{
 for(const value of ['Outfitter Gloves','|Hspell:116|h[Frostbolt]|h',42,null,undefined])assert.equal(itemFromLink(value),null);
 assert.equal(readableLinks(42),42);
 assert.equal(readableLinks('no links here'),'no links here');
});

test('every link in a string becomes "Name (id)"',()=>{
 assert.equal(readableLinks(`"${gloves}", 3, "${gloves.replace('11192','3153').replace('Outfitter Gloves','Oil-stained Cloak')}"`),'"Outfitter Gloves (11192)", 3, "Oil-stained Cloak (3153)"');
});

test('every equipment link in the real captures is readable',()=>{
 const root=new URL('../dist/',import.meta.url);
 const history=JSON.parse(readFileSync(new URL('history.json',root)));
 let links=0;
 for(const s of history.snapshots){
  const profile=JSON.parse(readFileSync(new URL(s.profileFile,root)));
  for(const entry of Object.values(profile.sections.equipment.entries)){
   const link=entry.fields.link,id=entry.fields.itemID;
   if(link?.state!=='value')continue;
   links++;
   const item=itemFromLink(link.value);
   assert.ok(item&&item.name,link.value);
   if(id?.state==='value')assert.equal(item.id,id.value);
  }
 }
 assert.ok(links>0);
});
