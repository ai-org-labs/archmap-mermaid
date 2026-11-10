type Metadata=Record<string,unknown>;
/** Strip one comment block without changing source line numbers. */
export function readArchmapMetadata(source:string):{metadata:Metadata;start:number;end:number;mermaidSource:string}{
 const lines=source.split(/\r?\n/),starts=lines.flatMap((s,i)=>/^\s*%%\s*archmap:/.test(s)?[i]:[]);
 if(starts.length>1)throw new Error('%% archmap: は1文書に1ブロックだけ指定してください。');
 if(!starts.length)return {metadata:{},start:-1,end:-1,mermaidSource:source};
 const start=starts[0];let end=start,raw='',depth=0,quoted=false,escaped=false,closed=false;
 for(let i=start;i<lines.length;i++){
  const match=i===start?lines[i].match(/^\s*%%\s*archmap:\s*(.*)$/):lines[i].match(/^\s*%% ?(.*)$/);
  if(!match)break;
  const fragment=match[1];
  if(i===start&&!fragment.trim().startsWith('{'))throw new Error('archmap の補助設定は { から始まるJSONオブジェクトです。');
  raw+=(i===start?'':'\n')+fragment;end=i;
  for(const c of fragment){
   if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){depth--;if(depth===0)closed=true;}
  }
  if(closed)break;
 }
 if(!closed)throw new Error('archmap のJSONが閉じていません。各行を %% で始め、最後を %% } で閉じてください。');
 const metadata:unknown=JSON.parse(raw);
 if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw new Error('archmap の補助設定はJSONオブジェクトです。');
 const stripped=lines.map((line,i)=>i>=start&&i<=end?'':line).join('\n');
 return {metadata:metadata as Metadata,start,end,mermaidSource:stripped};
}
/** Preserve multiline editing format when toolbar controls update metadata. */
export function updateArchmapMetadata(source:string,patch:Metadata):string{
 const {metadata,start,end}=readArchmapMetadata(source),lines=source.split(/\r?\n/);
 const merged={...metadata,...patch};
 const block=end>start?JSON.stringify(merged,null,2).split('\n').map((l,i)=>i===0?'%% archmap: '+l:'%% '+l):['%% archmap: '+JSON.stringify(merged)];
 if(start>=0)lines.splice(start,end-start+1,...block);
 else{
  const index=lines.findIndex(l=>/^(flowchart|graph)\b/.test(l.trim()));
  if(index<0)throw new Error('表示設定を挿入するflowchartがありません。');
  lines.splice(index,0,...block);
 }
 return lines.join('\n');
}
