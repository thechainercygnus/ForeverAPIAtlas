// Actual captured calls are kept separate from the partial symbol inventory.
let characterData, evidence = [], evidenceMatches = [], evidencePage = 0, evidenceSelected;
const evidenceSize = 12;
const sectionNames = {identityAndStats:'Identity & stats',stats:'Attributes',character:'Character',experience:'Experience',equipment:'Equipment',professions:'Learned professions',professionSkillLines:'Profession metadata',quests:'Quests',spells:'Spellbook entries',spellSkillLines:'Spellbook lines',reputation:'Reputation',currency:'Currency',skills:'General skills'};
function showView(view){
 $('#guide-panel').hidden=true;$('#guide').classList.remove('active');
 $('#profile-panel').hidden=view!=='profile';$('#profile-nav').classList.toggle('active',view==='profile');
 $('#character-panel').hidden=view!=='character'; $('#environment-panel').hidden=view!=='environment';
 $('#character-nav').classList.toggle('active',view==='character');$('#explore').classList.toggle('active',view==='environment');
}
$('#character-nav').onclick=()=>showView('character');
$('#explore').onclick=()=>{guide(false);showView('environment');};
$('#topics').addEventListener('click',()=>showView('environment'));
function typed(node){
 if(node.restricted)return `[restricted ${node.type}]`;
 if(node.truncated)return `[${node.type}: ${node.truncated}]`;
 if(node.type==='nil')return 'nil';
 if(node.type==='table')return '{table}';
 return Object.hasOwn(node,'value')?JSON.stringify(node.value):`[${node.type}]`;
}
function publicValue(node){return node&&!node.restricted&&!node.truncated?node.value:undefined;}
function tableValue(node,key){const e=node?.entries?.find(e=>publicValue(e.key)===key);return publicValue(e?.value);}
function argsText(q){return q.arguments.map(typed).join(', ');}
function evidenceFilter(){
 const term=$('#evidence-search').value.trim().toLowerCase(),section=$('#evidence-section').value,status=$('#evidence-status').value;
 evidenceMatches=evidence.filter(q=>(!section||q.section===section)&&(!status||(status==='restricted'?q.hasRestrictedValues:q.status===status))&&(!term||JSON.stringify(q).toLowerCase().includes(term)));
 evidencePage=0;evidenceRender();
}
function evidenceRender(){
 $('#evidence-count').textContent=evidenceMatches.length+' calls';
 const visible=evidenceMatches.slice(evidencePage*evidenceSize,(evidencePage+1)*evidenceSize);
 if(!evidenceMatches.includes(evidenceSelected))evidenceSelected=visible[0];
 $('#evidence-results').innerHTML=visible.map(q=>`<button class="row${q===evidenceSelected?' selected':''}" data-call="${q.index}"><span class="symbol"><strong>${esc(q.path.replace(/^_G\./,''))}</strong><small>(${esc(argsText(q))}) · ${esc(sectionNames[q.section]||q.section)}</small></span><span class="kind ${q.hasRestrictedValues?'value':q.status==='ok'?'':'other'}">${q.hasRestrictedValues?'RESTRICTED':q.status.toUpperCase()}</span></button>`).join('')||'<p class="empty">No matching calls. Clear the search or change your filters.</p>';
 $('#evidence-page').textContent=evidenceMatches.length?`${evidencePage*evidenceSize+1}–${Math.min((evidencePage+1)*evidenceSize,evidenceMatches.length)} of ${evidenceMatches.length}`:'0 calls';
 $('#evidence-prev').disabled=evidencePage===0;$('#evidence-next').disabled=(evidencePage+1)*evidenceSize>=evidenceMatches.length;
 evidenceDetail();
}
function evidenceDetail(){
 const q=evidenceSelected;
 if(!q){$('#evidence-detail').innerHTML='<p class="detail-note">No call selected.</p>';return;}
 const text=q.hasRestrictedValues?'The call returned, but one or more values are protected by the client. Restricted nodes contain no extracted payload.':q.status==='unavailable'?'This function was unavailable in the captured session. This does not establish that its underlying data is inaccessible through other APIs.':q.status==='error'?'This query recorded an error. Inspect the error evidence below.':'This exact invocation returned successfully in the captured session. Other arguments, contexts and builds remain unverified.';
 // Display typed nodes verbatim: positional nils and redaction are evidence.
 const result=q.returns?JSON.stringify(q.returns,null,2):q.error||q.serializationError||q.expansionError||'No return values captured.';
 const reference=`-- Observed invocation on build ${characterData.client.build}\n-- Review client context before running.\n${q.path}(${argsText(q)})`;
 $('#evidence-detail').innerHTML=`<div class="eyebrow">OBSERVED CALL · ${esc(q.status.toUpperCase())}</div><h3>${esc(q.path.replace(/^_G\./,''))}</h3><p class="detail-note">${text}</p><div class="detail-label">ARGUMENTS · ${q.argumentCount}</div><pre>${esc(JSON.stringify(q.arguments,null,2))}</pre><div class="detail-label">${q.returnCount===undefined?'RESULT':q.returnCount+' POSITIONAL RETURNS'} · TYPED EVIDENCE</div><pre>${esc(result)}</pre><details><summary>Captured query record</summary><pre>${esc(JSON.stringify(q,null,2))}</pre></details><div class="detail-label">OBSERVED LUA CALL</div><pre>${esc(reference)}</pre><button class="copy" id="copy-evidence">Copy observed call</button><p class="detail-note">Client ${esc(characterData.client.version)} · build ${esc(characterData.client.build)}<br>Captured ${esc(new Date(q.capturedAt*1000).toISOString())}<br>${esc(characterData.source)}</p>`;
 $('#copy-evidence').onclick=async()=>{try{await navigator.clipboard.writeText(reference);$('#copy-evidence').textContent='Copied ✓';}catch{$('#copy-evidence').textContent='Select and copy the reference above';}};
}
let evidenceLoad=0;
async function loadCharacter(source='character.json'){const load=++evidenceLoad;try{
 const response=await fetch(source);if(!response.ok)throw Error('Character evidence unavailable');const captured=await response.json();
 if(load!==evidenceLoad)return;characterData=captured;
 if(!characterData){$('#character-panel').innerHTML='<p class="empty">No character capture in this export. Run /api character in game and import the combined SavedVariables file.</p>';return;}
 evidence=characterData.queries.map((q,index)=>({...q,index}));
 window.AtlasEvidence={count:path=>evidence.filter(q=>q.path===path).length,open:path=>{
  showView('character');$('#evidence-search').value=path;$('#evidence-section').value='';$('#evidence-status').value='';evidenceFilter();$('#evidence-results').scrollIntoView({behavior:'smooth',block:'start'});
 }};
 const stats=characterData.statistics;
 const learned=evidence.filter(q=>q.path==='_G.GetProfessionInfo'&&q.status==='ok');
 const professions=learned.map(q=>`<div class="profession"><strong>${esc(publicValue(q.returns[0])??'Unknown')}</strong><span>${esc(publicValue(q.returns[2])??'?')} / ${esc(publicValue(q.returns[3])??'?')}</span><small>Profession index ${esc(publicValue(q.arguments[0]))}</small></div>`).join('');
 const metadata=evidence.filter(q=>q.path==='_G.C_TradeSkillUI.GetProfessionInfoBySkillLineID'&&q.status==='ok');
 const metadataRows=metadata.map(q=>`<tr><td>${esc(publicValue(q.arguments[0]))}</td><td>${esc(tableValue(q.returns[0],'professionName')??'Unknown')}</td><td>${esc(tableValue(q.returns[0],'skillLevel')??'?')} / ${esc(tableValue(q.returns[0],'maxSkillLevel')??'?')}</td></tr>`).join('');
 const name=evidence.find(q=>q.path==='_G.UnitName'&&q.status==='ok');
 $('#character-panel').innerHTML=`<div class="evidence-heading"><div><div class="eyebrow">FROM DISCOVERY TO OBSERVED CALLS</div><h2>Character evidence <span>${esc(publicValue(name?.returns?.[0])??'Snapshot')}</span></h2><p class="detail-note">Actual arguments and returns from addon ${esc(characterData.addonVersion)} · ${esc(new Date(characterData.capturedAt*1000).toISOString())}</p></div><a href="${esc(source)}" download class="download">↓ Export evidence</a></div><div class="metrics">${[['queries','Captured calls'],['ok','Successful calls'],['restrictedQueries','Include restricted values'],['unavailable','Unavailable functions']].map(([key,label])=>`<div class="metric"><label>${label}</label><strong>${stats[key]||0}</strong></div>`).join('')}</div><p class="detail-note">${stats.error} errors. Restricted calls are included in successful calls. These are observations from one session, not exhaustive signatures or a live game connection.</p><h2>Learned professions</h2><p class="detail-note">Identified through GetProfessions and its returned indices. Broader skill-line metadata does not establish that a profession is learned.</p><div class="profession-grid">${professions||'<p>No profession details captured.</p>'}</div><details class="metadata"><summary>Broader profession metadata · ${metadata.length} skill lines</summary><p class="detail-note">Includes parent/child lines, unlearned professions and test entries. Keep these out of the learned-profession list.</p><table><thead><tr><th>Skill-line ID</th><th>Reported name</th><th>Skill / maximum</th></tr></thead><tbody>${metadataRows}</tbody></table></details><div class="workspace-heading"><h2>Observed queries <span id="evidence-count"></span></h2><span class="muted">Search names, IDs, arguments and returns</span></div><div class="toolbar"><label class="search"><span>⌕</span><input id="evidence-search" type="search" aria-label="Search observed queries" placeholder="Try Frostbolt, UnitHealth, or an item ID…"></label><select id="evidence-section" aria-label="Evidence category"><option value="">All categories</option>${[...new Set(evidence.map(q=>q.section))].map(s=>`<option value="${esc(s)}">${esc(sectionNames[s]||s)}</option>`).join('')}</select><select id="evidence-status" aria-label="Evidence status"><option value="">All outcomes</option><option value="ok">Successful</option><option value="restricted">Restricted values</option><option value="unavailable">Unavailable</option><option value="error">Errors</option></select></div><div class="browser"><div class="list-pane"><div class="list-heading"><span>FUNCTION / ARGUMENTS</span><span>OUTCOME</span></div><div id="evidence-results" aria-live="polite"></div><div class="pagination"><button id="evidence-prev">← Previous</button><span id="evidence-page"></span><button id="evidence-next">Next →</button></div></div><section id="evidence-detail" aria-label="Observed query details"></section></div>`;
 $('#evidence-search').oninput=evidenceFilter;$('#evidence-section').onchange=evidenceFilter;$('#evidence-status').onchange=evidenceFilter;
 $('#evidence-prev').onclick=()=>{evidencePage--;evidenceRender();};$('#evidence-next').onclick=()=>{evidencePage++;evidenceRender();};
 $('#evidence-results').onclick=e=>{const b=e.target.closest('[data-call]');if(b){evidenceSelected=evidence[Number(b.dataset.call)];evidenceRender();}};
 evidenceFilter();
 }catch(e){if(load!==evidenceLoad)return;$('#character-panel').innerHTML='<p class="empty">Unable to load character evidence. Refresh to retry, or use Symbol explorer for the environment catalog.</p>';console.error(e);}}
loadCharacter();
