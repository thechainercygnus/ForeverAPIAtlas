// Views and their state live in the URL hash (#view=explorer&q=UnitName&symbol=_G.UnitName),
// so every view, search and selection can be bookmarked, shared and reached with Back/Forward.
// Each view registers Atlas.handlers[view](params); handlers render from the URL and must be
// idempotent, because the same state can be applied more than once.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const views = {
 explorer:{panel:'#environment-panel',title:'Symbol explorer'},
 evidence:{panel:'#character-panel',title:'Character evidence'},
 profile:{panel:'#profile-panel',title:'Character profile'},
 guide:{panel:'#guide-panel',title:'Reading the snapshot'},
};
const Atlas = window.Atlas = {handlers:{}}; // window.Atlas for the profile.js module
let currentView, appliedHash, started=false;
Atlas.params = () => new URLSearchParams(location.hash.slice(1));
Atlas.view = (p=Atlas.params()) => views[p.get('view')] ? p.get('view') : 'explorer';
// A link to a state: href(view, {q:'UnitName'}); empty values are left out.
Atlas.href = (view, state={}) => '#'+new URLSearchParams([['view',view],...Object.entries(state).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>[k,String(v)])]).toString();
// Merge changes into the current state. push adds a history entry (selections, drill-downs);
// typing and filter changes replace the current one so Back isn't flooded.
Atlas.set = (changes,{push=false}={}) => {
 // Switching views starts from a clean state; one view's filters mean nothing to another.
 const switching=changes.view&&changes.view!==Atlas.view();
 const p=switching?new URLSearchParams():Atlas.params(); if(!p.has('view'))p.set('view',Atlas.view(p));
 for(const [k,v] of Object.entries(changes)){if(v===''||v==null)p.delete(k);else p.set(k,String(v));}
 const hash='#'+p.toString();
 if(hash!==location.hash)history[push?'pushState':'replaceState'](null,'',hash);
 apply(true);
};
// Re-apply the current state, e.g. once a view's data has loaded.
Atlas.refresh = () => { if(started) apply(true); };
Atlas.title = detail => { document.title=[detail,views[currentView]?.title,'Forever API Atlas'].filter(Boolean).join(' · '); };
function apply(force=false){
 if(!force&&location.hash===appliedHash)return; // hashchange and popstate both fire on Back
 appliedHash=location.hash;
 const p=Atlas.params(), view=Atlas.view(p), changed=view!==currentView, initial=currentView===undefined;
 currentView=view;
 for(const [name,{panel}] of Object.entries(views))$(panel).hidden=name!==view;
 for(const link of document.querySelectorAll('[data-view]')){
  if(link.dataset.view===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
 if(changed){
  Atlas.title('');
  const panel=$(views[view].panel);
  if(!initial&&panel.getBoundingClientRect().top<0)panel.scrollIntoView({block:'start'});
 }
 Atlas.handlers[view]?.(p);
}
addEventListener('hashchange',()=>apply());
addEventListener('popstate',()=>apply());
// Deferred and module scripts have all run (and registered their handlers) by DOMContentLoaded.
document.addEventListener('DOMContentLoaded',()=>{started=true;apply(true);});
