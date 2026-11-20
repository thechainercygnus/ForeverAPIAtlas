// Missing entries describe coverage, never proof of learning/unlearning or removal.
export function fieldsOf(profile){
 const fields={};
 for(const [section,data] of Object.entries(profile.sections)){
  for(const [key,value] of Object.entries(data.fields))fields[`${section}.${key}`]=value;
  for(const [id,entry] of Object.entries(data.entries))
   for(const [key,value] of Object.entries(entry.fields))fields[`${section}.${id}.${key}`]=value;
 }
 return fields;
}
const reliable = field => field && ['value','empty'].includes(field.state);
const same = (a,b) => a.state===b.state && JSON.stringify(a.value)===JSON.stringify(b.value);
export function compareProfiles(before,after){
 if(before.schemaVersion!==1||after.schemaVersion!==1)throw Error('Unsupported profile schema');
 if(before.characterGUID!==after.characterGUID)throw Error('Choose two snapshots of the same character.');
 if(before.capturedAt>after.capturedAt)throw Error('The before snapshot must precede the after snapshot.');
 const left=fieldsOf(before),right=fieldsOf(after),rows=[];
 const compatible=before.client.build!=null&&after.client.build!=null&&before.client.locale&&after.client.locale
  ?String(before.client.build)===String(after.client.build)&&before.client.locale===after.client.locale:false;
 for(const path of [...new Set([...Object.keys(left),...Object.keys(right)])].sort()){
  const a=left[path]||{state:'notCaptured',evidence:[]}, b=right[path]||{state:'notCaptured',evidence:[]};
  let kind;
  if(!reliable(a)||!reliable(b))kind=(reliable(b)&&!reliable(a))?'newlyObserved':'notComparable';
  else if(same(a,b))kind='unchanged';
  else kind=compatible?'changed':'notComparable';
  rows.push({path,kind,before:a,after:b});
 }
 return {before:before.snapshotId,after:after.snapshotId,compatibleBuild:compatible,rows,
  counts:Object.fromEntries(['changed','newlyObserved','notComparable','unchanged'].map(k=>[k,rows.filter(r=>r.kind===k).length]))};
}
