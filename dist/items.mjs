// WoW item links, as the client returns them:
//   |cnIQ1:|Hitem:11192::::::::13:1482::11:::::::|h[Outfitter Gloves]|h|r
// The colour prefix and the trailing |r are optional. Only the item ID and the bracketed name
// are read; the rest of the link (level, bonus IDs…) is context, not identity.
const LINK=/(?:\|c[^|]*)?\|Hitem:(\d+)[^|]*\|h\[([^\]]*)\]\|h(?:\|r)?/g;

// The first item in a string, as {id, name}, or null.
export function itemFromLink(text){
 if(typeof text!=='string')return null;
 const m=new RegExp(LINK.source).exec(text);
 return m?{id:Number(m[1]),name:m[2]}:null;
}

// The same text with every item link replaced by "Name (id)". Non-strings pass through.
export function readableLinks(text){
 return typeof text==='string'?text.replace(LINK,(_,id,name)=>`${name} (${id})`):text;
}
