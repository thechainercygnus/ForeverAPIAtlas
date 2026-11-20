// API coverage: which normalized fields a capture returned, from which calls, and in what state.
// Values are never compared: a level-up, more money or an emptied slot is gameplay, not coverage.
// Collection entries (equipment slots, spells, quests…) are pooled per field (equipment.*.itemID),
// so captures of different characters compare by what the API returned, not by what they hold.
// Missing data is coverage too: a field absent from one side is "not captured", never "removed".

export const STATES = ['value','empty','restricted','unavailable','error','partial','notCaptured'];
export const KINDS = ['becameRestricted','becameUnavailable','nowAvailable','newlyCaptured','notCapturedAfter','otherChange','unchanged'];

// One row per field: {key, section, field, collection, states:{state:count}, calls:[path], observations:[{entry, state, evidence}]}.
export function coverageOf(profile){
 if(profile.schemaVersion!==1)throw Error('Unsupported profile schema');
 const keys=new Map();
 const add=(key,section,field,observation,entry=null)=>{
  let row=keys.get(key);
  if(!row){row={key,section,field,collection:entry!==null,states:{},calls:new Set(),observations:[]};keys.set(key,row);}
  row.states[observation.state]=(row.states[observation.state]||0)+1;
  for(const e of observation.evidence)row.calls.add(e.functionPath);
  row.observations.push({entry,state:observation.state,evidence:observation.evidence});
 };
 for(const [section,data] of Object.entries(profile.sections)){
  for(const [field,observation] of Object.entries(data.fields))add(`${section}.${field}`,section,field,observation);
  for(const [id,entry] of Object.entries(data.entries))
   for(const [field,observation] of Object.entries(entry.fields))add(`${section}.*.${field}`,section,field,observation,id);
 }
 return [...keys.values()].map(row=>({...row,calls:[...row.calls].sort()}));
}

// What a side of a comparison is: the capture, its character, addon and client.
function describe(profile){
 const name=profile.sections.identity?.fields?.name;
 return {snapshotId:profile.snapshotId,characterGUID:profile.characterGUID,name:name?.state==='value'?name.value:null,
  capturedAt:profile.capturedAt,addonVersion:profile.addonVersion,build:profile.client?.build??null,locale:profile.client?.locale??null};
}
// value and empty both mean the call returned; unavailable and error both mean it failed.
const groupOf=state=>state==='value'||state==='empty'?'returned':state==='unavailable'||state==='error'?'failed':state;
const groups=states=>new Set(Object.entries(states).filter(([s,n])=>n>0&&s!=='notCaptured').map(([s])=>groupOf(s)));
function classify(before,after){
 const B=before?groups(before.states):new Set(),A=after?groups(after.states):new Set();
 if(!B.size)return A.size?'newlyCaptured':'unchanged';
 if(!A.size)return 'notCapturedAfter';
 if(A.has('restricted')&&!B.has('restricted'))return 'becameRestricted';
 if(A.has('failed')&&!B.has('failed'))return 'becameUnavailable';
 if(A.has('returned')&&(!B.has('returned')||(B.has('restricted')&&!A.has('restricted'))||(B.has('failed')&&!A.has('failed'))))return 'nowAvailable';
 return [...A].every(g=>B.has(g))&&[...B].every(g=>A.has(g))?'unchanged':'otherChange';
}
const side=row=>row?{states:row.states,calls:row.calls}:null;

// Compares coverage between any two captures: across time, addon versions, client builds and characters.
export function compareProfiles(before,after){
 const left=new Map(coverageOf(before).map(r=>[r.key,r])),right=new Map(coverageOf(after).map(r=>[r.key,r]));
 const rows=[...new Set([...left.keys(),...right.keys()])].sort().map(key=>{
  const b=left.get(key),a=right.get(key);
  return {key,kind:classify(b,a),before:side(b),after:side(a)};
 });
 const b=describe(before),a=describe(after);
 return {before:b,after:a,sameCharacter:b.characterGUID===a.characterGUID,sameBuild:b.build!=null&&b.build===a.build&&b.locale===a.locale,rows,
  counts:Object.fromEntries(KINDS.map(k=>[k,rows.filter(r=>r.kind===k).length]))};
}
