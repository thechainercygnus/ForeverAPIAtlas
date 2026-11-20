import {compareProfiles} from './compare.mjs';
const el=s=>document.querySelector(s);
const html=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={identity:'Identity',stats:'Stats & experience',equipment:'Equipment',professions:'Learned professions',spells:'Spellbook entries',quests:'Quest log',reputation:'Reputation'};
const slots=['','Head','Neck','Shoulder','Shirt','Chest','Waist','Legs','Feet','Wrists','Hands','Finger 1','Finger 2','Trinket 1','Trinket 2','Back','Main hand','Off hand','Ranged','Tabard'];
const states={empty:'Empty result',restricted:'Restricted',unavailable:'API unavailable',error:'Query error',notCaptured:'Not captured',partial:'Partial result'};
const kinds={changed:'Observed change',newlyObserved:'Newly observed',notComparable:'Not comparable',unchanged:'Unchanged'};
const stamp=t=>new Date(t*1000).toLocaleString();
const display=f=>f?.state==='value'?String(f.value):states[f?.state]||'Not captured';
let history=[],current,comparison,querySearch='',sectionFilter='',outcome='changed';
let comparisonRun=0,profileRun=0;
const profiles=new Map(),raw=new Map();
el('#profile-nav').onclick=()=>window.showView('profile');
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw Error(`Unable to load ${path}`);return r.json();}
async function profileFor(id){if(!profiles.has(id)){const entry=history.find(s=>s.snapshotId===id);if(!entry)throw Error('Snapshot not found');profiles.set(id,await getJSON(entry.profileFile));}return profiles.get(id);}
function option(s){return `<option value="${html(s.snapshotId)}">${html(s.name)} · ${html(stamp(s.capturedAt))} · v${html(s.addonVersion)}</option>`;}
function refButton(field,snapshotId){return field.evidence.length?`<button class="evidence-link" data-snapshot="${html(snapshotId)}" data-query="${field.evidence[0].queryIndex}">Evidence ↗</button>`:'<span class="muted">No query</span>';}
function label(section,id,entry){
 if(section==='equipment')return `${slots[Number(id)]||'Slot '+id} · ${display(entry.fields.itemID)}`;
 return display(entry.fields.name||entry.fields.title||{state:'value',value:id})+' · '+id;
}
function renderProfile(){
 const id=current.sections.identity.fields,stats=current.sections.stats.fields;
 el('#profile-title').textContent=`${display(id.name)} · Level ${display(id.level)} ${display(id.race)} ${display(id.class)}`;
 el('#profile-meta').textContent=`${stamp(current.capturedAt)} · addon ${current.addonVersion} · build ${current.client.build} · ${current.source}`;
 el('#profile-download').href=history.find(s=>s.snapshotId===current.snapshotId).profileFile;
 const selected=sectionFilter?{[sectionFilter]:current.sections[sectionFilter]}:current.sections;
 el('#profile-stats').innerHTML=[['XP',stats.xp],['Maximum health',stats.maxHealth],['Current health',stats.health],['Money (copper)',stats.moneyCopper]].map(([label,f])=>`<div class="metric"><label>${html(label)}</label><strong>${html(display(f))}</strong></div>`).join('');
 let count=0;
 el('#profile-sections').innerHTML=Object.entries(selected).map(([section,data])=>{
  const groups=[];
  if(Object.keys(data.fields).length)groups.push({title:titles[section],fields:data.fields});
  for(const [id,entry] of Object.entries(data.entries))groups.push({title:label(section,id,entry),fields:entry.fields});
  const rows=groups.map(group=>{
   const fields=Object.entries(group.fields).filter(([key,f])=>!querySearch||`${section} ${group.title} ${key} ${display(f)}`.toLowerCase().includes(querySearch));
   count+=fields.length;
   return fields.length?`<tr class="group-row"><th colspan="4">${html(group.title)}</th></tr>${fields.map(([key,f])=>`<tr><td>${html(key)}</td><td class="value-cell">${html(display(f))}</td><td><span class="state-label">${html(f.state)}</span></td><td>${refButton(f,current.snapshotId)}</td></tr>`).join('')}`:'';
  }).join('');
  return `<details class="profile-section" ${section==='identity'||sectionFilter||querySearch?'open':''}><summary>${html(titles[section])} · observed coverage</summary>${rows?`<div class="table-scroll"><table><thead><tr><th>Field</th><th>Observed value</th><th>State</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p class="detail-note">No matching fields were captured. Missing entries do not establish an empty collection.</p>'}</details>`;
 }).join('');
 el('#profile-field-count').textContent=count+' matching fields';
}
function valueCell(f,snapshotId){return `<span>${html(display(f))}</span><br>${refButton(f,snapshotId)}`;}
async function renderComparison(){
 const run=++comparisonRun;
 try{
  const before=await profileFor(el('#compare-before').value),after=await profileFor(el('#compare-after').value);
  if(run!==comparisonRun)return;
  comparison=compareProfiles(before,after);
  el('#comparison-export').disabled=false;
  el('#comparison-error').textContent=comparison.compatibleBuild?'':'Build or locale differs: changed values are not comparable.';
  el('#comparison-counts').innerHTML=Object.entries(comparison.counts).map(([kind,count])=>`<div class="metric"><label>${html(kinds[kind])}</label><strong>${count}</strong></div>`).join('');
  const rows=comparison.rows.filter(r=>(!outcome||r.kind===outcome)&&(!querySearch||`${r.path} ${display(r.before)} ${display(r.after)}`.toLowerCase().includes(querySearch)));
  el('#comparison-results').innerHTML=rows.length?`<div class="table-scroll"><table><thead><tr><th>Field</th><th>Before</th><th>After</th><th>Assessment</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="path-cell">${html(r.path)}</td><td>${valueCell(r.before,before.snapshotId)}</td><td>${valueCell(r.after,after.snapshotId)}</td><td>${html(kinds[r.kind])}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No fields match this assessment. Choose another outcome or clear the search.</p>';
 }catch(e){if(run!==comparisonRun)return;comparison=null;el('#comparison-export').disabled=true;el('#comparison-error').textContent=e.message;el('#comparison-results').innerHTML='';el('#comparison-counts').innerHTML='';}
}
async function openEvidence(button){
 const dialog=el('#profile-evidence');el('#profile-evidence-body').textContent='Loading source query…';dialog.showModal();
 try{const p=await profileFor(button.dataset.snapshot);if(!raw.has(p.snapshotId))raw.set(p.snapshotId,await getJSON(p.evidenceFile));const q=raw.get(p.snapshotId).queries[Number(button.dataset.query)];el('#profile-evidence-body').textContent=JSON.stringify({snapshot:p.snapshotId,source:p.source,query:q},null,2);}
 catch(e){el('#profile-evidence-body').textContent=e.message;}
}
function updateSelectors(){
 const guid=el('#profile-character').value;
 const list=history.filter(s=>s.characterGUID===guid).sort((a,b)=>a.capturedAt-b.capturedAt);
 el('#profile-snapshot').innerHTML=[...list].reverse().map(option).join('');
 el('#compare-before').innerHTML=list.map(option).join('');el('#compare-after').innerHTML=list.map(option).join('');
 el('#compare-before').value=list.length>1?list[list.length-2].snapshotId:list[0].snapshotId;
 el('#compare-after').value=list.at(-1).snapshotId;
 el('#history-note').textContent=`${list.length} retained snapshots for this character. ${list.length===1?'Only one capture is available; the comparison currently shows this capture on both sides. ':''}Times use your browser timezone. Character evidence follows the selected profile snapshot.`;
 return list.at(-1).snapshotId;
}
async function choose(id){const run=++profileRun;try{const loaded=await profileFor(id);if(run!==profileRun)return;current=loaded;el('#profile-error').textContent='';renderProfile();window.loadCharacter(loaded.evidenceFile);await renderComparison();}catch(e){if(run===profileRun)el('#profile-error').textContent=e.message;}}
async function init(){try{
 const result=await getJSON('history.json');if(result.schemaVersion!==1)throw Error('Unsupported history schema');history=result.snapshots;
 if(!history.length){el('#profile-panel').innerHTML='<p class="empty">No character history yet. Import a character capture to build a profile.</p>';return;}
 const characters=[...new Map(history.map(s=>[s.characterGUID,s])).values()];
 el('#profile-panel').innerHTML=`<div class="evidence-heading"><div><div class="eyebrow">YOUR CHARACTER / SNAPSHOT HISTORY</div><h2>Character profile</h2></div><div class="profile-actions"><a class="download" id="profile-download" download>↓ Profile JSON</a><a class="download" href="profile.schema.json" download>Schema v1</a></div></div><div class="toolbar"><div class="field grow"><label for="profile-character">Character</label><select id="profile-character">${characters.map(s=>`<option value="${html(s.characterGUID)}">${html(s.name)} · ${html(s.characterGUID)}</option>`).join('')}</select></div><div class="field grow"><label for="profile-snapshot">Snapshot</label><select id="profile-snapshot"></select></div></div><p id="history-note" class="detail-note"></p><h2 id="profile-title"></h2><p id="profile-meta" class="detail-note"></p><div class="metrics" id="profile-stats"></div><div class="warning"><span>△</span><div><strong>Observed data with explicit gaps</strong><p>Restricted, unavailable, partial and missing values remain distinct. Missing collection entries never prove removals.</p></div></div><p class="detail-note" id="profile-error" role="alert"></p><div class="toolbar"><div class="field grow"><label for="profile-search">Search profile and comparison</label><div class="search"><span aria-hidden="true">⌕</span><input type="search" id="profile-search" placeholder="e.g. an item ID, a spell, or a value"></div></div><div class="field"><label for="profile-section">Section</label><select id="profile-section"><option value="">All sections</option>${Object.entries(titles).map(([k,v])=>`<option value="${k}">${html(v)}</option>`).join('')}</select></div></div><p class="muted" id="profile-field-count"></p><div id="profile-sections"></div><details class="profile-section" id="comparison-panel"><summary>Compare snapshots</summary><p class="detail-note">Changes compare public values captured in both snapshots. Newly observed fields indicate expanded coverage, not newly learned abilities. Empty results describe observations, not confirmed gameplay actions. Different builds or locales suppress change claims.</p><div class="toolbar"><div class="field grow"><label for="compare-before">Before</label><select id="compare-before"></select></div><div class="field grow"><label for="compare-after">After</label><select id="compare-after"></select></div></div><p id="comparison-error" class="detail-note" role="alert"></p><div class="metrics" id="comparison-counts"></div><div class="field"><label for="comparison-outcome">Assessment</label><select id="comparison-outcome">${Object.entries(kinds).map(([k,v])=>`<option value="${k}">${html(v)}</option>`).join('')}<option value="">All assessments</option></select></div><button id="comparison-export" class="copy" disabled>Download comparison JSON</button><div id="comparison-results" aria-live="polite"></div></details><dialog id="profile-evidence"><button class="copy" id="close-profile-evidence">Close evidence</button><h2>Source query</h2><pre id="profile-evidence-body"></pre></dialog>`;
 el('#profile-character').onchange=()=>choose(updateSelectors());
 el('#profile-snapshot').onchange=()=>choose(el('#profile-snapshot').value);
 el('#profile-search').oninput=()=>{querySearch=el('#profile-search').value.trim().toLowerCase();renderProfile();renderComparison();};
 el('#profile-section').onchange=()=>{sectionFilter=el('#profile-section').value;renderProfile();};
 el('#comparison-export').onclick=()=>{if(!comparison)return;const url=URL.createObjectURL(new Blob([JSON.stringify(comparison,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='forever-character-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 el('#compare-before').onchange=renderComparison;el('#compare-after').onchange=renderComparison;
 el('#comparison-outcome').onchange=()=>{outcome=el('#comparison-outcome').value;renderComparison();};
 el('#profile-panel').onclick=e=>{const b=e.target.closest('[data-query]');if(b)openEvidence(b);};
 el('#close-profile-evidence').onclick=()=>el('#profile-evidence').close();
 await choose(updateSelectors());
 }catch(e){el('#profile-panel').innerHTML=`<p class="empty">Unable to load character history: ${html(e.message)}. Character evidence and Symbol explorer remain available.</p>`;}}
init();
