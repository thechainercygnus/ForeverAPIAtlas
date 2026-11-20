// Symbol explorer. Its state (search, filters, page, selected symbol) lives in the URL; see nav.js.
let data, rows=[], byPath=new Map(), matches=[], selected, page=0, filterKey;
const pageSize=10;
const topics={ 'Identity & stats':/^_G\.(Unit(Name|Level|Class|Race|Sex|GUID|Health|Power|Stat|Armor)|GetUnitName)/, 'Equipment & items':/^_G\.(GetInventory|GetItem|C_Item\.)/, 'Quests & progress':/^_G\.(C_QuestLog\.|GetQuest|IsQuest)/, 'Skills & spells':/^_G\.(GetSkill|GetSpell|C_Spell\.|GetTalent|GetProfession)/, 'Reputation & currency':/^_G\.(GetFaction|GetCurrency|GetMoney|C_CurrencyInfo\.|C_Reputation\.)/ };
const short=path=>path.replace(/^_G\./,'');
// The explorer's current state, read from the URL.
function state(p){return {q:p.get('q')||'',kind:p.get('kind')||'all',scope:p.get('scope')||'all',topic:topics[p.get('topic')]?p.get('topic'):'',page:Math.max(0,Number(p.get('page'))||0),symbol:p.get('symbol')||''};}
// A link to this view with some state changed; selection links keep the filters and page.
function link(changes){const p=Atlas.params(),s={q:p.get('q'),kind:p.get('kind'),scope:p.get('scope'),topic:p.get('topic'),page:p.get('page'),symbol:p.get('symbol'),...changes};return Atlas.href('explorer',s);}
function filter({q,kind,scope,topic}){
 const term=q.trim().toLowerCase();
 return rows.filter(r=>(kind==='all'||r.kind===kind)&&(!topic||topics[topic].test(r.path))&&(scope!=='root'||/^_G\.[A-Za-z_]\w*$/.test(r.path))&&(scope!=='namespace'||/^_G\.C_\w+\./.test(r.path))&&(!term||r.path.toLowerCase().includes(term)||(r.kind==='value'&&String(r.value).toLowerCase().includes(term))));
}
function explorer(p){
 if(!data)return;
 const s=state(p);
 if($('#search').value!==s.q)$('#search').value=s.q;
 $('#scope').value=s.scope;
 const key=JSON.stringify([s.q,s.kind,s.scope,s.topic]);
 if(key!==filterKey){filterKey=key;matches=filter(s);}
 page=Math.min(s.page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
 selected=byPath.get(s.symbol)||matches[page*pageSize];
 for(const b of document.querySelectorAll('.filter'))b.setAttribute('aria-pressed',String(b.dataset.kind===s.kind));
 for(const b of document.querySelectorAll('.topic'))b.setAttribute('aria-pressed',String(b.dataset.topic===s.topic));
 $('#topic-note').hidden=!s.topic;$('#topic-note').textContent=s.topic+' · Name-based research leads. Behavior and extraction support remain unverified.';
 render();detail();
 Atlas.title(selected?short(selected.path):'');
}
Atlas.handlers.explorer=explorer;
function render(){
 $('#result-count').textContent=matches.length.toLocaleString()+' results';
 const slice=matches.slice(page*pageSize,(page+1)*pageSize);
 $('#results').innerHTML=slice.map(r=>`<a class="row" href="${esc(link({symbol:r.path}))}"${selected===r?' aria-current="true"':''}><span class="symbol"><strong>${esc(short(r.path))}</strong><small>${esc(r.path.startsWith('_G.C_')?'Namespaced symbol':/^_G\.[A-Za-z_]\w*$/.test(r.path)?'Root global':'Nested environment path')}</small></span><span class="kind ${r.kind}">${r.kind.toUpperCase()}</span></a>`).join('')||'<p class="empty">No matching symbols. Try a broader search or clear your filters.</p>';
 $('#page').textContent=matches.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,matches.length)} of ${matches.length.toLocaleString()}`:'0 results';
 $('#prev').disabled=page===0; $('#next').disabled=(page+1)*pageSize>=matches.length;
}
function detail(){
 if(!selected){$('#detail').innerHTML='<p class="detail-note">Select a symbol to inspect its captured evidence.</p>';return;}
 const r=selected;
 const note=r.kind==='function'?'This path resolved to a function during the scan. Arguments, return values, behavior and safety were not captured. Verify the contract in game before calling it.':r.kind==='table'?'A table was found at this path. Descendants may be absent because of alias deduplication, depth limits or the scan entry limit.':r.kind==='value'?'This is the value observed during this snapshot. It may be UI text, a constant, configuration or addon state; it is not automatically character data.':'An opaque Lua object was observed here. The dump records its type, without serializing its internals.';
 const snippet=r.kind==='function'?`-- Observed function reference; signature unknown\nlocal fn = ${r.path}\n-- Confirm arguments and returns before calling.`:`-- Observed ${r.kind} reference\nlocal value = ${r.path}`;
 const calls=window.AtlasEvidence?.count(r.path)||0;
 $('#detail').innerHTML=`${calls?`<a class="copy" href="${esc(Atlas.href('evidence',{q:r.path}))}">View ${calls} captured calls →</a>`:''}<span class="eyebrow">SYMBOL DETAIL</span><h3>${esc(short(r.path))}</h3><div class="detail-path">${esc(r.path)}</div><p><span class="kind ${r.kind}">${esc(r.type||r.kind)}</span> <span class="tag">DISCOVERED</span></p><div class="detail-label">WHAT WE KNOW</div><p class="detail-note">${note}</p>${r.kind==='table'?`<p class="detail-note">Recorded depth: ${r.depth}</p><a class="copy" href="${esc(Atlas.href('explorer',{q:r.path}))}">Browse descendants →</a>`:''}${r.kind==='value'?`<div class="detail-label">CAPTURED VALUE${r.truncated?' · TRUNCATED TO 512 BYTES':''}</div><pre>${esc(JSON.stringify(r.value,null,2))}</pre>`:''}<div class="detail-label">LUA REFERENCE</div><pre>${esc(snippet)}</pre><button class="copy" id="copy">Copy Lua reference</button><p class="detail-note">Reference only · run reviewed code in the WoW client.<br>Source: ${esc(data.source)}</p>`;
 $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(snippet);$('#copy').textContent='Copied ✓';}catch{$('#copy').textContent='Select and copy the reference above';}};
}
// Typing, filters and paging replace the history entry; picking a symbol (a link) adds one.
$('#search').oninput=()=>Atlas.set({q:$('#search').value,page:'',symbol:''});
$('#scope').onchange=()=>Atlas.set({scope:$('#scope').value==='all'?'':$('#scope').value,page:'',symbol:''});
$('#prev').onclick=()=>Atlas.set({page:page-1||'',symbol:''});
$('#next').onclick=()=>Atlas.set({page:page+1,symbol:''});
async function init(){try{
 const response=await fetch('catalog.json');if(!response.ok)throw Error('Catalog unavailable');data=await response.json();rows=data.records.sort((a,b)=>a.path.localeCompare(b.path));
 for(const r of rows)byPath.set(r.path,r);
 $('#client').textContent=`Client ${data.client.version} / build ${data.client.build} / ${data.client.locale}`;
 const labels=[['functions','Functions','Paths discovered'],['tables','Tables','Environment structure'],['values','Values','Captured primitives'],['other','Other objects','Opaque Lua types']];
 $('#metrics').innerHTML=labels.map(([k,l,n])=>`<div class="metric"><label>${l}</label><strong>${data.statistics[k].toLocaleString()}</strong><small>${n}</small></div>`).join('');
 $('#filters').innerHTML=['all','function','table','value','other'].map(k=>`<button type="button" class="filter" data-kind="${k}" aria-pressed="${k==='all'}">${k==='all'?'All symbols':k[0].toUpperCase()+k.slice(1)+'s'}</button>`).join('');
 $('#filters').onclick=e=>{const b=e.target.closest('[data-kind]');if(b)Atlas.set({kind:b.dataset.kind==='all'?'':b.dataset.kind,page:'',symbol:''});};
 $('#topics').innerHTML=Object.keys(topics).map(t=>`<button type="button" class="topic" data-topic="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('');
 $('#topics').onclick=e=>{const b=e.target.closest('[data-topic]');if(!b)return;const on=Atlas.view()==='explorer'&&Atlas.params().get('topic')===b.dataset.topic;Atlas.set({view:'explorer',topic:on?'':b.dataset.topic,kind:on?'':'function',q:'',scope:'',page:'',symbol:''},{push:true});};
 Atlas.refresh();
 }catch(e){$('#client').textContent='Snapshot could not load';$('#results').innerHTML='<p class="empty">Unable to load the catalog. Refresh the page to retry.</p>';console.error(e);}}
init();
