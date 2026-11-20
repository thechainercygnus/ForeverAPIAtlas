const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, rows=[], matches=[], selected, page=0, kind='all', topic='';
const pageSize=10;
const topics={ 'Identity & stats':/^_G\.(Unit(Name|Level|Class|Race|Sex|GUID|Health|Power|Stat|Armor)|GetUnitName)/, 'Equipment & items':/^_G\.(GetInventory|GetItem|C_Item\.)/, 'Quests & progress':/^_G\.(C_QuestLog\.|GetQuest|IsQuest)/, 'Skills & spells':/^_G\.(GetSkill|GetSpell|C_Spell\.|GetTalent|GetProfession)/, 'Reputation & currency':/^_G\.(GetFaction|GetCurrency|GetMoney|C_CurrencyInfo\.|C_Reputation\.)/ };
function filter(){
 const q=$('#search').value.trim().toLowerCase(),scope=$('#scope').value;
 matches=rows.filter(r=>(kind==='all'||r.kind===kind)&&(!topic||topics[topic].test(r.path))&&(scope!=='root'||/^_G\.[A-Za-z_]\w*$/.test(r.path))&&(scope!=='namespace'||/^_G\.C_\w+\./.test(r.path))&&(!q||r.path.toLowerCase().includes(q)||(r.kind==='value'&&String(r.value).toLowerCase().includes(q))));
 page=0; render();
}
function render(){
 $('#result-count').textContent=matches.length.toLocaleString()+' results';
 const slice=matches.slice(page*pageSize,(page+1)*pageSize);
 $('#results').innerHTML=slice.map(r=>`<button class="row${selected===r?' selected':''}" data-index="${r.index}"><span class="symbol"><strong>${esc(r.path.replace(/^_G\./,''))}</strong><small>${esc(r.path.startsWith('_G.C_')?'Namespaced symbol':/^_G\.[A-Za-z_]\w*$/.test(r.path)?'Root global':'Nested environment path')}</small></span><span class="kind ${r.kind}">${r.kind.toUpperCase()}</span></button>`).join('')||'<p class="empty">No matching symbols. Try a broader search or clear your filters.</p>';
 $('#page').textContent=matches.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,matches.length)} of ${matches.length.toLocaleString()}`:'0 results';
 $('#prev').disabled=page===0; $('#next').disabled=(page+1)*pageSize>=matches.length;
 if(!matches.includes(selected)){selected=slice[0]; detail();}
}
function detail(){
 if(!selected){$('#detail').innerHTML='<p class="detail-note">Select a symbol to inspect its captured evidence.</p>';return;}
 const r=selected;
 const note=r.kind==='function'?'This path resolved to a function during the scan. Arguments, return values, behavior and safety were not captured. Verify the contract in game before calling it.':r.kind==='table'?'A table was found at this path. Descendants may be absent because of alias deduplication, depth limits or the scan entry limit.':r.kind==='value'?'This is the value observed during this snapshot. It may be UI text, a constant, configuration or addon state; it is not automatically character data.':'An opaque Lua object was observed here. The dump records its type, without serializing its internals.';
 const snippet=r.kind==='function'?`-- Observed function reference; signature unknown\nlocal fn = ${r.path}\n-- Confirm arguments and returns before calling.`:`-- Observed ${r.kind} reference\nlocal value = ${r.path}`;
 $('#detail').innerHTML=`<span class="eyebrow">SYMBOL DETAIL</span><h3>${esc(r.path.replace(/^_G\./,''))}</h3><div class="detail-path">${esc(r.path)}</div><p><span class="kind ${r.kind}">${esc(r.type||r.kind)}</span> <span class="tag">DISCOVERED</span></p><div class="detail-label">WHAT WE KNOW</div><p class="detail-note">${note}</p>${r.kind==='table'?`<p class="detail-note">Recorded depth: ${r.depth}</p><button class="copy" id="children">Browse descendants →</button>`:''}${r.kind==='value'?`<div class="detail-label">CAPTURED VALUE${r.truncated?' · TRUNCATED TO 512 BYTES':''}</div><pre>${esc(JSON.stringify(r.value,null,2))}</pre>`:''}<div class="detail-label">LUA REFERENCE</div><pre>${esc(snippet)}</pre><button class="copy" id="copy">Copy Lua reference</button><p class="detail-note">Reference only · run reviewed code in the WoW client.<br>Source: ${esc(data.source)}</p>`;
 $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(snippet);$('#copy').textContent='Copied ✓';}catch{$('#copy').textContent='Select and copy the reference above';}};
 if(window.AtlasEvidence?.count(r.path)){
  const button=document.createElement('button');button.className='copy';button.textContent=`View ${window.AtlasEvidence.count(r.path)} captured calls →`;
  button.onclick=()=>window.AtlasEvidence.open(r.path);$('#detail').prepend(button);
 }
 if($('#children'))$('#children').onclick=()=>{kind='all';topic='';$('#search').value=r.path;$('#scope').value='all';syncFilters();filter();};
}
function syncFilters(){document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));document.querySelectorAll('.topic').forEach(b=>b.classList.toggle('active',b.textContent===topic));$('#topic-note').hidden=!topic;$('#topic-note').textContent=topic+' · Name-based research leads. Behavior and extraction support remain unverified.';}
// The guide is a view like the others; showView (character.js) switches panels and nav state.
function guide(){showView('guide');$('#guide-panel').scrollIntoView({behavior:'smooth',block:'start'});}
$('#guide').onclick=guide;$('#learn').onclick=guide;
$('#search').oninput=filter;$('#scope').onchange=filter;
$('#prev').onclick=()=>{page--;render();};$('#next').onclick=()=>{page++;render();};
$('#results').onclick=e=>{const b=e.target.closest('[data-index]');if(b){selected=rows[Number(b.dataset.index)];detail();render();}};
async function init(){try{
 const response=await fetch('catalog.json');if(!response.ok)throw Error('Catalog unavailable');data=await response.json();rows=data.records.sort((a,b)=>a.path.localeCompare(b.path));rows.forEach((r,i)=>r.index=i);
 $('#client').textContent=`Client ${data.client.version} / build ${data.client.build} / ${data.client.locale}`;
 const labels=[['functions','Functions','Paths discovered'],['tables','Tables','Environment structure'],['values','Values','Captured primitives'],['other','Other objects','Opaque Lua types']];
 $('#metrics').innerHTML=labels.map(([k,l,n])=>`<div class="metric"><label>${l}</label><strong>${data.statistics[k].toLocaleString()}</strong><small>${n}</small></div>`).join('');
 $('#filters').innerHTML=['all','function','table','value','other'].map(k=>`<button class="filter ${k==='all'?'active':''}" data-kind="${k}">${k==='all'?'All symbols':k[0].toUpperCase()+k.slice(1)+'s'}</button>`).join('');
 $('#filters').onclick=e=>{const b=e.target.closest('[data-kind]');if(b){kind=b.dataset.kind;syncFilters();filter();}};
 $('#topics').innerHTML=Object.keys(topics).map(t=>`<button class="topic">${esc(t)}</button>`).join('');
 $('#topics').onclick=e=>{const b=e.target.closest('button');if(b){topic=topic===b.textContent?'':b.textContent;kind='function';$('#search').value='';$('#scope').value='all';syncFilters();filter();}};
 selected=rows.find(r=>r.path==='_G.UnitName');filter();detail();
 }catch(e){$('#client').textContent='Snapshot could not load';$('#results').innerHTML='<p class="empty">Unable to load the catalog. Refresh the page to retry.</p>';console.error(e);}}
init();
