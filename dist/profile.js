// API coverage view: for each normalized field, the call that supplies it and the states it came
// back in (decided in #18: the Character Planner tracks progress; the atlas tracks the API).
import {compareProfiles,coverageOf,STATES,KINDS} from './compare.mjs';
import {itemFromLink,readableLinks} from './items.mjs';
window.Atlas.readableLinks=readableLinks; // for character.js's call summaries
const el=s=>document.querySelector(s);
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={identity:'Identity',stats:'Stats & experience',equipment:'Equipment',professions:'Learned professions',spells:'Spellbook entries',quests:'Quest log',reputation:'Reputation'};
const units={equipment:'slot',professions:'profession',spells:'spellbook entry',quests:'quest',reputation:'faction'};
const slots=['','Head','Neck','Shoulder','Shirt','Chest','Waist','Legs','Feet','Wrists','Hands','Finger 1','Finger 2','Trinket 1','Trinket 2','Back','Main hand','Off hand','Ranged','Tabard'];
const stateNames={value:'Value',empty:'Empty result',restricted:'Restricted',unavailable:'API unavailable',error:'Query error',partial:'Partial result',notCaptured:'Not captured'};
const kinds={becameRestricted:'Became restricted',becameUnavailable:'Became unavailable',nowAvailable:'Now available',newlyCaptured:'Newly captured',notCapturedAfter:'Not captured in After',otherChange:'Other state change',unchanged:'Unchanged'};
const stamp=t=>new Date(t*1000).toLocaleString();
const display=f=>f?.state==='value'?String(f.value):stateNames[f?.state]||'Not captured';
let history=[],current,comparison,querySearch='',sectionFilter='',stateFilter='',outcome='changes';
let comparisonRun=0,profileRun=0;
const profiles=new Map(),raw=new Map();
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`Unable to load ${path}`);return r.json();}
async function profileFor(id){if(!profiles.has(id)){const entry=history.find(s=>s.snapshotId===id);if(!entry)throw Error('Snapshot not found');profiles.set(id,await getJSON(entry.profileFile));}return profiles.get(id);}
function option(s){return `<option value="${html(s.snapshotId)}">${html(s.name)} · ${html(stamp(s.capturedAt))} · v${html(s.addonVersion)}</option>`;}
// Each button's accessible name says which record it opens, since there are many of them.
function refButton(observation,snapshotId,label){return observation.evidence.length?`<button type="button" class="evidence-link" data-snapshot="${html(snapshotId)}" data-query="${observation.evidence[0].queryIndex}" aria-label="Evidence for ${html(label)}">Evidence ↗</button>`:'<span class="muted">No query</span>';}
function entryLabel(section,id){
 const f=current.sections[section].entries[id]?.fields||{};
 if(section==='equipment'){
  // "Hands · Outfitter Gloves (11192)": the item's name comes from its link, the raw link stays in the evidence.
  const slot=slots[Number(id)]||'Slot '+id,item=f.link?.state==='value'?itemFromLink(f.link.value):null;
  return item?`${slot} · ${item.name} (${item.id})`:f.itemID?.state==='value'?`${slot} · item ${f.itemID.value}`:slot;
 }
 const name=f.name||f.title;return name?.state==='value'?`${name.value} · ${id}`:id;
}
const chips=(states,always=false)=>`<span class="states">${STATES.filter(s=>states[s]).map(s=>`<span class="state-label state-${s}">${html(stateNames[s])}${always||states[s]>1?` ×${states[s]}`:''}</span>`).join('')}</span>`;
function renderProfile(){
 const id=current.sections.identity.fields;
 el('#profile-title').textContent=`${display(id.name)} · Level ${display(id.level)} ${display(id.race)} ${display(id.class)}`;
 el('#profile-meta').textContent=`${stamp(current.capturedAt)} · addon ${current.addonVersion} · build ${current.client.build} · ${current.source}`;
 el('#profile-download').href=history.find(s=>s.snapshotId===current.snapshotId).profileFile;
 const rows=coverageOf(current),totals={};
 for(const r of rows)for(const [s,n] of Object.entries(r.states))totals[s]=(totals[s]||0)+n;
 el('#profile-states').innerHTML=STATES.filter(s=>totals[s]).map(s=>`<div class="metric"><label>${html(stateNames[s])}</label><strong>${totals[s]}</strong><small>field observations</small></div>`).join('');
 const visible=rows.filter(r=>(!sectionFilter||r.section===sectionFilter)&&(!stateFilter||r.states[stateFilter])&&(!querySearch||`${r.key} ${r.calls.join(' ')} ${titles[r.section]}`.toLowerCase().includes(querySearch)));
 el('#profile-sections').innerHTML=Object.keys(titles).map(section=>{
  const list=visible.filter(r=>r.section===section);
  if(!list.length)return '';
  const body=list.map(r=>{
   const n=r.observations.length,label=`${titles[section]} ${r.field}`;
   const source=r.collection?`<details class="entries"><summary>${n} ${n===1?'entry':'entries'}</summary><ul>${r.observations.map(o=>`<li><span>${html(entryLabel(section,o.entry))}</span><span class="state-label">${html(stateNames[o.state])}</span>${refButton(o,current.snapshotId,`${label}, ${entryLabel(section,o.entry)}`)}</li>`).join('')}</ul></details>`:refButton(r.observations[0],current.snapshotId,label);
   return `<tr><th scope="row"><code>${html(r.field)}</code>${r.collection?`<small>per ${html(units[section]||'entry')} · ${n} captured</small>`:''}</th><td data-label="Supplied by"><code class="calls-cell">${r.calls.map(c=>html(c.replace(/^_G\./,''))).join('<br>')||'<span class="muted">none</span>'}</code></td><td data-label="States">${chips(r.states,r.collection)}</td><td data-label="Evidence">${source}</td></tr>`;
  }).join('');
  return `<details class="profile-section" open><summary>${html(titles[section])} · ${list.length} ${list.length===1?'field':'fields'}</summary><div class="table-scroll" tabindex="0" role="region" aria-labelledby="caption-${section}"><table><caption id="caption-${section}" class="visually-hidden">${html(titles[section])} coverage</caption><thead><tr><th scope="col">Field</th><th scope="col">Supplied by</th><th scope="col">States</th><th scope="col">Evidence</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
 }).join('')||'<p class="empty">No fields match. Clear the search or change the section or state.</p>';
 el('#profile-field-count').textContent=`${visible.length} of ${rows.length} fields`;
}
const sideText=s=>`${s.name??'Unknown character'} · addon ${s.addonVersion} · build ${s.build??'?'} · ${stamp(s.capturedAt)}`;
async function renderComparison(){
 const run=++comparisonRun;
 try{
  const before=await profileFor(el('#compare-before').value),after=await profileFor(el('#compare-after').value);
  if(run!==comparisonRun)return;
  comparison=compareProfiles(before,after);
  el('#comparison-export').disabled=false;el('#comparison-error').textContent='';
  el('#comparison-sides').textContent=`Before: ${sideText(comparison.before)}. After: ${sideText(comparison.after)}.`+
   (comparison.sameBuild?'':' Different client builds or locales: a change may come from the client, not the addon.')+
   (comparison.sameCharacter?'':' Different characters: entries are pooled per field, so this compares what the API returned, not what each character holds.');
  el('#comparison-counts').innerHTML=KINDS.filter(k=>comparison.counts[k]).map(k=>`<div class="metric"><label>${html(kinds[k])}</label><strong>${comparison.counts[k]}</strong></div>`).join('');
  const rows=comparison.rows.filter(r=>(outcome==='changes'?r.kind!=='unchanged':!outcome||r.kind===outcome)&&(!sectionFilter||r.key.startsWith(sectionFilter+'.'))&&(!querySearch||`${r.key} ${[...(r.before?.calls||[]),...(r.after?.calls||[])].join(' ')}`.toLowerCase().includes(querySearch)));
  const cell=s=>s?chips(s.states):'<span class="muted">Not captured</span>';
  el('#comparison-results').innerHTML=rows.length?`<div class="table-scroll" tabindex="0" role="region" aria-labelledby="caption-comparison"><table><caption id="caption-comparison" class="visually-hidden">Coverage comparison</caption><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Assessment</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row" class="path-cell">${html(r.key)}<small>${html([...new Set([...(r.before?.calls||[]),...(r.after?.calls||[])])].map(c=>c.replace(/^_G\./,'')).join(', '))}</small></th><td data-label="Before">${cell(r.before)}</td><td data-label="After">${cell(r.after)}</td><td data-label="Assessment">${html(kinds[r.kind])}</td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">${outcome==='changes'?'No coverage changes between these captures.':'No fields match this assessment. Choose another or clear the search.'}</p>`;
 }catch(e){if(run!==comparisonRun)return;comparison=null;el('#comparison-export').disabled=true;el('#comparison-error').textContent=e.message;el('#comparison-results').innerHTML='';el('#comparison-counts').innerHTML='';el('#comparison-sides').textContent='';}
}
async function openEvidence(button){
 // The title names the field, taken from the button's "Evidence for …" label.
 const dialog=el('#profile-evidence'),what=(button.getAttribute('aria-label')||'').replace(/^Evidence for /,'');
 el('#profile-evidence-title').textContent=what?`Source query for ${what}`:'Source query';
 el('#profile-evidence-body').textContent='Loading source query…';dialog.showModal();
 try{const p=await profileFor(button.dataset.snapshot);if(!raw.has(p.snapshotId))raw.set(p.snapshotId,await getJSON(p.evidenceFile));const q=raw.get(p.snapshotId).queries[Number(button.dataset.query)];el('#profile-evidence-body').textContent=JSON.stringify({snapshot:p.snapshotId,source:p.source,query:q},null,2);}
 catch(e){el('#profile-evidence-body').textContent=e.message;}
}
// The comparison can pair any two captures; it defaults to this character's previous capture,
// or the latest capture of another character when this one has only one.
function updateSelectors(){
 const guid=el('#profile-character').value;
 const all=[...history].sort((a,b)=>a.capturedAt-b.capturedAt),list=all.filter(s=>s.characterGUID===guid);
 el('#profile-snapshot').innerHTML=[...list].reverse().map(option).join('');
 el('#compare-before').innerHTML=all.map(option).join('');el('#compare-after').innerHTML=all.map(option).join('');
 const before=list.length>1?list.at(-2):all.filter(s=>s.characterGUID!==guid).at(-1)||list[0];
 el('#compare-before').value=before.snapshotId;el('#compare-after').value=list.at(-1).snapshotId;
 el('#history-note').textContent=`${list.length} ${list.length===1?'capture':'captures'} of this character, ${history.length} in total. Times use your browser timezone. Character evidence follows the selected capture.`;
 return list.at(-1).snapshotId;
}
async function choose(id){const run=++profileRun;try{const loaded=await profileFor(id);if(run!==profileRun)return;current=loaded;el('#profile-error').textContent='';renderProfile();setTitle();window.loadCharacter(loaded.evidenceFile);await renderComparison();}catch(e){if(run===profileRun)el('#profile-error').textContent=e.message;}}
function setTitle(){if(current&&window.Atlas.view()==='profile')window.Atlas.title(display(current.sections.identity.fields.name));}
// The coverage view's state (snapshot, search, section, state) lives in the URL; see nav.js.
function profileView(p){
 if(!history.length||!el('#profile-character'))return;
 const latest=guid=>history.filter(s=>s.characterGUID===guid).sort((a,b)=>a.capturedAt-b.capturedAt).at(-1);
 const entry=history.find(s=>s.snapshotId===p.get('snapshot'))||latest(el('#profile-character').value);
 if(el('#profile-character').value!==entry.characterGUID){el('#profile-character').value=entry.characterGUID;updateSelectors();}
 el('#profile-snapshot').value=entry.snapshotId;
 const search=p.get('search')||'';if(el('#profile-search').value!==search)el('#profile-search').value=search;
 querySearch=search.trim().toLowerCase();
 sectionFilter=Object.hasOwn(titles,p.get('section')??'')?p.get('section'):'';el('#profile-section').value=sectionFilter;
 stateFilter=STATES.find(s=>s===p.get('state'))??'';el('#profile-state').value=stateFilter;
 if(current?.snapshotId!==entry.snapshotId)choose(entry.snapshotId);else{renderProfile();renderComparison();setTitle();}
}
window.Atlas.handle('profile',profileView);
async function init(){try{
 const result=await getJSON('history.json');if(result.schemaVersion!==1)throw Error('Unsupported history schema');history=result.snapshots;
 if(!history.length){el('#profile-panel').innerHTML='<p class="empty">No captures yet. Import a character capture to map API coverage.</p>';return;}
 const characters=[...new Map(history.map(s=>[s.characterGUID,s])).values()];
 el('#profile-panel').innerHTML=`<div class="evidence-heading"><div><div class="eyebrow">API COVERAGE / CAPTURE HISTORY</div><h2>API coverage</h2></div><div class="profile-actions"><a class="download" id="profile-download" download>↓ Profile JSON</a><a class="download" href="profile.schema.json" download>Schema v1</a></div></div><p class="detail-note">Each row is a field the importer normalizes from a character capture: the call that supplies it and the states it came back in. Collection fields, such as equipment slots and spells, are counted across their entries. Values are in each field's evidence.</p><div class="toolbar"><div class="field grow"><label for="profile-character">Character</label><select id="profile-character">${characters.map(s=>`<option value="${html(s.characterGUID)}">${html(s.name)} · ${html(s.characterGUID)}</option>`).join('')}</select></div><div class="field grow"><label for="profile-snapshot">Capture</label><select id="profile-snapshot"></select></div></div><p id="history-note" class="detail-note"></p><h2 id="profile-title"></h2><p id="profile-meta" class="detail-note"></p><div class="metrics" id="profile-states"></div><div class="warning"><span>△</span><div><strong>Observed data with explicit gaps</strong><p>Restricted, unavailable, partial and missing values remain distinct. Missing collection entries never prove removals.</p></div></div><p class="detail-note" id="profile-error" role="alert"></p><div class="toolbar"><div class="field grow"><label for="profile-search">Search fields and calls</label><div class="search"><span aria-hidden="true">⌕</span><input type="search" id="profile-search" placeholder="e.g. itemID or GetInventoryItemID"></div></div><div class="field"><label for="profile-section">Section</label><select id="profile-section"><option value="">All sections</option>${Object.entries(titles).map(([k,v])=>`<option value="${k}">${html(v)}</option>`).join('')}</select></div><div class="field"><label for="profile-state">State</label><select id="profile-state"><option value="">All states</option>${STATES.map(s=>`<option value="${s}">${html(stateNames[s])}</option>`).join('')}</select></div></div><p class="muted" id="profile-field-count"></p><div id="profile-sections"></div><details class="profile-section" id="comparison-panel"><summary>Compare coverage between captures</summary><p class="detail-note">Compares which fields each capture returned and in what state, across captures, addon versions, client builds and characters. Value changes, such as a level-up, aren't coverage and aren't reported. A field missing from one side is "not captured", never "removed".</p><div class="toolbar"><div class="field grow"><label for="compare-before">Before</label><select id="compare-before"></select></div><div class="field grow"><label for="compare-after">After</label><select id="compare-after"></select></div></div><p id="comparison-sides" class="detail-note"></p><p id="comparison-error" class="detail-note" role="alert"></p><div class="metrics" id="comparison-counts"></div><div class="field"><label for="comparison-outcome">Assessment</label><select id="comparison-outcome"><option value="changes">All changes</option>${KINDS.map(k=>`<option value="${k}">${html(kinds[k])}</option>`).join('')}<option value="">All fields</option></select></div><button type="button" id="comparison-export" class="copy" disabled>Download comparison JSON</button><div id="comparison-results"></div></details><dialog id="profile-evidence" aria-labelledby="profile-evidence-title" closedby="any"><h2 id="profile-evidence-title">Source query</h2><pre id="profile-evidence-body"></pre><form method="dialog"><button class="copy" autofocus>Close evidence</button></form></dialog>`;
 el('#profile-character').onchange=()=>window.Atlas.set({snapshot:updateSelectors()},{push:true});
 el('#profile-snapshot').onchange=()=>window.Atlas.set({snapshot:el('#profile-snapshot').value},{push:true});
 el('#profile-search').oninput=()=>window.Atlas.set({search:el('#profile-search').value});
 el('#profile-section').onchange=()=>window.Atlas.set({section:el('#profile-section').value});
 el('#profile-state').onchange=()=>window.Atlas.set({state:el('#profile-state').value});
 el('#comparison-export').onclick=()=>{if(!comparison)return;const url=URL.createObjectURL(new Blob([JSON.stringify(comparison,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='forever-coverage-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 el('#compare-before').onchange=renderComparison;el('#compare-after').onchange=renderComparison;
 el('#comparison-outcome').onchange=()=>{outcome=el('#comparison-outcome').value;renderComparison();};
 el('#profile-panel').onclick=e=>{const b=e.target.closest('[data-query]');if(b)openEvidence(b);};
 await choose(updateSelectors());
 window.Atlas.refresh();
 }catch(e){el('#profile-panel').innerHTML=`<p class="empty">Unable to load capture history: ${html(e.message)}. Character evidence and Symbol explorer remain available.</p>`;}}
init();
