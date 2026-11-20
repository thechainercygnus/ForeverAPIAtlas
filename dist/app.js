// Symbol explorer. Its state (search, filters, browsed table, page, selected symbol) lives in the URL; see nav.js.
let data, rows=[], byPath=new Map(), childCount=new Map(), matches=[], selected, page=0, filterKey;
const pageSize=50;
const topics={ 'Identity & stats':/^_G\.(Unit(Name|Level|Class|Race|Sex|GUID|Health|Power|Stat|Armor)|GetUnitName)/, 'Equipment & items':/^_G\.(GetInventory|GetItem|C_Item\.)/, 'Quests & progress':/^_G\.(C_QuestLog\.|GetQuest|IsQuest)/, 'Skills & spells':/^_G\.(GetSkill|GetSpell|C_Spell\.|GetTalent|GetProfession)/, 'Reputation & currency':/^_G\.(GetFaction|GetCurrency|GetMoney|C_CurrencyInfo\.|C_Reputation\.)/ };
const short=path=>path.replace(/^_G\./,'');
// The table a path belongs to: _G.C_QuestLog.GetInfo → _G.C_QuestLog, _G.SlashCmdList["/afk"] → _G.SlashCmdList.
const parentOf=path=>path.match(/^(.+?)(?:\.[A-Za-z_]\w*|\[[^\]]*\])$/)?.[1]??'';
const lastSegment=path=>path.slice(parentOf(path).length).replace(/^\./,'')||path;
// The explorer's current state, read from the URL.
function state(p){return {q:p.get('q')||'',kind:p.get('kind')||'all',scope:p.get('scope')||'all',topic:topics[p.get('topic')]?p.get('topic'):'',under:byPath.has(p.get('under'))?p.get('under'):'',page:Math.max(0,Number(p.get('page'))||0),symbol:p.get('symbol')||''};}
// A link to this view with some state changed; selection links keep the filters and page.
function link(changes){const p=Atlas.params(),s={q:p.get('q'),kind:p.get('kind'),scope:p.get('scope'),topic:p.get('topic'),under:p.get('under'),page:p.get('page'),symbol:p.get('symbol'),...changes};return Atlas.href('explorer',s);}
// Browsing a table lists its direct children; searching while browsing looks through all its descendants.
function filter({q,kind,scope,topic,under}){
 const term=q.trim().toLowerCase();
 return rows.filter(r=>(!under||(term?r.path.startsWith(under+'.')||r.path.startsWith(under+'['):r.parent===under))&&(kind==='all'||r.kind===kind)&&(!topic||topics[topic].test(r.path))&&(scope!=='root'||/^_G\.[A-Za-z_]\w*$/.test(r.path))&&(scope!=='namespace'||/^_G\.C_\w+\./.test(r.path))&&(!term||r.path.toLowerCase().includes(term)||(r.kind==='value'&&String(r.value).toLowerCase().includes(term))));
}
function explorer(p){
 if(!data)return;
 const s=state(p);
 if($('#search').value!==s.q)$('#search').value=s.q;
 $('#scope').value=s.scope;$('#topic').value=s.topic;
 const key=JSON.stringify([s.q,s.kind,s.scope,s.topic,s.under]);
 if(key!==filterKey){filterKey=key;matches=filter(s);}
 page=Math.min(s.page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
 // A link to a symbol without a page opens the page that lists it.
 const linked=byPath.get(s.symbol),at=linked&&!p.has('page')?matches.indexOf(linked):-1;
 if(at>=0)page=Math.floor(at/pageSize);
 selected=linked||matches[page*pageSize];
 for(const b of document.querySelectorAll('.filter'))b.setAttribute('aria-pressed',String(b.dataset.kind===s.kind));
 $('#topic-note').hidden=!s.topic;$('#topic-note').textContent=s.topic+' · Name-based research leads. Behavior and extraction support remain unverified.';
 breadcrumbs(s.under);render();detail();
 Atlas.title(selected?short(selected.path):s.under?short(s.under):'');
}
Atlas.handlers.explorer=explorer;
function breadcrumbs(under){
 if(!under){$('#browse').innerHTML=`<p class="muted">Searching all paths · <a href="${esc(Atlas.href('explorer',{under:'_G'}))}">Browse from _G</a> or open a table's children from its detail.</p>`;return;}
 const trail=[];for(let p=under;p;p=parentOf(p))trail.unshift(p);
 $('#browse').innerHTML=`<nav class="breadcrumb" aria-label="Breadcrumbs"><ol><li><a href="${esc(Atlas.href('explorer',{}))}">All paths</a></li>${trail.map(p=>`<li><a href="${esc(Atlas.href('explorer',{under:p}))}"${p===under?' aria-current="page"':''}>${esc(lastSegment(p))}</a></li>`).join('')}</ol></nav>`;
}
function render(){
 $('#result-count').textContent=matches.length.toLocaleString()+' results';
 const slice=matches.slice(page*pageSize,(page+1)*pageSize);
 const where=r=>r.path.startsWith('_G.C_')?'Namespaced symbol':/^_G\.[A-Za-z_]\w*$/.test(r.path)?'Root global':'Nested environment path';
 $('#results').innerHTML=slice.map(r=>{const n=childCount.get(r.path);return `<a class="row" href="${esc(link({symbol:r.path}))}"${selected===r?' aria-current="true"':''}><span class="symbol"><strong>${esc(short(r.path))}</strong><small>${esc(where(r))}${n?` · ${n.toLocaleString()} ${n===1?'child':'children'}`:''}</small></span><span class="kind ${r.kind}">${r.kind.toUpperCase()}</span></a>`;}).join('')||'<p class="empty">No matching symbols. Try a broader search or clear your filters.</p>';
 // Keep the selected row in view inside the scrolling list, without scrolling the page.
 const current=$('#results [aria-current=true]'),list=$('#results');
 if(!current)list.scrollTop=0;
 else{const top=current.offsetTop-list.offsetTop;if(top<list.scrollTop||top+current.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=Math.max(0,top-list.clientHeight/3);}
 $('#page').textContent=matches.length?`${page*pageSize+1}–${Math.min((page+1)*pageSize,matches.length)} of ${matches.length.toLocaleString()}`:'0 results';
 $('#prev').disabled=page===0; $('#next').disabled=(page+1)*pageSize>=matches.length;
}
function detail(){
 if(!selected){$('#detail').innerHTML='<p class="detail-note">Select a symbol to inspect its captured evidence.</p>';return;}
 const r=selected;
 const calls=window.AtlasEvidence?.calls(r.path)||[];
 const children=childCount.get(r.path)||0;
 const note=r.kind==='function'?(calls.length?`A character capture called this function ${calls.length===1?'once':calls.length+' times'}; the calls are below. Other arguments, contexts and builds remain unverified.`:'This path resolved to a function during the scan. Arguments, return values, behavior and safety were not captured. Verify the contract in game before calling it.'):r.kind==='table'?'A table was found at this path. Descendants may be absent because of alias deduplication, depth limits or the scan entry limit.':r.kind==='value'?'This is the value observed during this snapshot. It may be UI text, a constant, configuration or addon state; it is not automatically character data.':'An opaque Lua object was observed here. The dump records its type, without serializing its internals.';
 const snippet=r.kind==='function'?(calls.length?`-- Observed call from a character capture\n${r.path}(${window.AtlasEvidence.args(calls[0])})\n-- Other arguments and contexts are unverified.`:`-- Observed function reference; signature unknown\nlocal fn = ${r.path}\n-- Confirm arguments and returns before calling.`):`-- Observed ${r.kind} reference\nlocal value = ${r.path}`;
 const shown=calls.slice(0,6),ev=window.AtlasEvidence;
 const callList=calls.length?`<div class="detail-label">CAPTURED CALLS · ${calls.length}</div><ul class="calls">${shown.map(q=>`<li><a href="${esc(Atlas.href('evidence',{q:r.path,call:q.index}))}"><code>${esc(short(r.path))}(${esc(ev.args(q))})</code><span class="kind ${ev.outcome(q)[1]}">${ev.outcome(q)[0]}</span></a><div class="call-result">→ ${esc(ev.result(q))}</div></li>`).join('')}</ul><a class="copy" href="${esc(Atlas.href('evidence',{q:r.path}))}">${calls.length>shown.length?`All ${calls.length} calls`:'Open in Character evidence'} →</a>`:'';
 const tableInfo=r.kind==='table'?`<p class="detail-note">Recorded depth: ${r.depth} · ${children?`${children.toLocaleString()} ${children===1?'child':'children'} captured`:'no children captured'}</p>${children?`<a class="copy" href="${esc(Atlas.href('explorer',{under:r.path}))}">Browse ${children.toLocaleString()} ${children===1?'child':'children'} →</a>`:''}`:'';
 const parent=parentOf(r.path);
 $('#detail').innerHTML=`<span class="eyebrow">SYMBOL DETAIL</span><h3>${esc(short(r.path))}</h3><div class="detail-path">${esc(r.path)}${parent&&byPath.has(parent)?` · in <a href="${esc(Atlas.href('explorer',{under:parent,symbol:r.path}))}">${esc(short(parent))}</a>`:''}</div><p><span class="kind ${r.kind}">${esc(r.type||r.kind)}</span> <span class="tag">DISCOVERED</span></p><div class="detail-label">WHAT WE KNOW</div><p class="detail-note">${note}</p>${callList}${tableInfo}${r.kind==='value'?`<div class="detail-label">CAPTURED VALUE${r.truncated?' · TRUNCATED TO 512 BYTES':''}</div><pre>${esc(JSON.stringify(r.value,null,2))}</pre>`:''}<div class="detail-label">LUA REFERENCE</div><pre>${esc(snippet)}</pre><button class="copy" id="copy">Copy Lua reference</button><p class="detail-note">Reference only · run reviewed code in the WoW client.<br>Source: ${esc(data.source)}</p>`;
 $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(snippet);$('#copy').textContent='Copied ✓';}catch{$('#copy').textContent='Select and copy the reference above';}};
}
// Typing, filters and paging replace the history entry; picking a symbol or a table (links) adds one.
$('#search').oninput=()=>Atlas.set({q:$('#search').value,page:'',symbol:''});
$('#scope').onchange=()=>Atlas.set({scope:$('#scope').value==='all'?'':$('#scope').value,page:'',symbol:''});
$('#topic').innerHTML='<option value="">All topics</option>'+Object.keys(topics).map(t=>`<option>${esc(t)}</option>`).join('');
$('#topic').onchange=()=>Atlas.set({topic:$('#topic').value,page:'',symbol:''});
$('#prev').onclick=()=>Atlas.set({page:page-1||'',symbol:''});
$('#next').onclick=()=>Atlas.set({page:page+1,symbol:''});
async function init(){try{
 const response=await fetch('catalog.json');if(!response.ok)throw Error('Catalog unavailable');data=await response.json();rows=data.records.sort((a,b)=>a.path.localeCompare(b.path));
 for(const r of rows){byPath.set(r.path,r);r.parent=parentOf(r.path);if(r.parent)childCount.set(r.parent,(childCount.get(r.parent)||0)+1);}
 $('#client').textContent=`Client ${data.client.version} / build ${data.client.build} / ${data.client.locale}`;
 const labels=[['functions','Functions','Paths discovered'],['tables','Tables','Environment structure'],['values','Values','Captured primitives'],['other','Other objects','Opaque Lua types']];
 $('#metrics').innerHTML=labels.map(([k,l,n])=>`<div class="metric"><label>${l}</label><strong>${data.statistics[k].toLocaleString()}</strong><small>${n}</small></div>`).join('');
 $('#filters').innerHTML=['all','function','table','value','other'].map(k=>`<button type="button" class="filter" data-kind="${k}" aria-pressed="${k==='all'}">${k==='all'?'All symbols':k[0].toUpperCase()+k.slice(1)+'s'}</button>`).join('');
 $('#filters').onclick=e=>{const b=e.target.closest('[data-kind]');if(b)Atlas.set({kind:b.dataset.kind==='all'?'':b.dataset.kind,page:'',symbol:''});};
 Atlas.refresh();
 }catch(e){$('#client').textContent='Snapshot could not load';$('#results').innerHTML='<p class="empty">Unable to load the catalog. Refresh the page to retry.</p>';console.error(e);}}
init();
