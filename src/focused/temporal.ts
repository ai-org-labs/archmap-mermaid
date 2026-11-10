import type {EventModel} from '@mermaid-js/parser';
import type {DiagramModel,DiagramNode,DiagramLayout,DiagramLayoutNode,DiagramEdge} from './types.js';
import {wrapText} from './layout.js';

const category=(type:string)=>['ui','pcr','processor'].includes(type)?'UI / 自動処理':['cmd','command','rmo','readmodel'].includes(type)?'コマンド / 参照モデル':'イベント';
const kindLabel:Record<string,string>={ui:'UI',pcr:'Processor',processor:'Processor',cmd:'Command',command:'Command',rmo:'Read model',readmodel:'Read model',evt:'Event',event:'Event'};
/** Copy only semantic data. Never retain Langium references or invoke Mermaid's DOM renderer. */
export function readEventModel(ast:EventModel):Partial<DiagramModel> {
  if(ast.noteEntities.length||ast.gwtEntities.length||ast.modelEntities.length)throw Error('Event Modelingの独立したnote / GWT / entity定義は未対応です。frameとdata定義を使用してください。');
  const inferenceLanes:string[]=[];
  const nodes:DiagramNode[]=[],edges:DiagramEdge[]=[];const seen=new Set<string>();
  for(const [i,f] of ast.frames.entries()){
    if(seen.has(f.name))throw Error(`フレームID ${f.name} が重複しています。`);seen.add(f.name);
    const entity=String(f.entityIdentifier),ns=entity.includes('.')?entity.slice(0,entity.lastIndexOf('.')):'',cat=category(f.modelEntityType);
    // Mermaid 12.3 allocates a new inference lane for a two-part namespace.
    // Visual lanes may be merged; do not let that change inferred relations.
    inferenceLanes.push(entity.split('.').length===2?'frame:'+f.name:cat);
    const data=f.dataReference?ast.dataEntities.find(d=>d.name===f.dataReference!.$refText)?.dataBlockValue:f.dataInlineValue;
    if(f.dataReference&&!data)throw Error(`data参照 ${f.dataReference.$refText} がありません。`);
    if(f.dataType||(f.dataReference&&ast.dataEntities.find(d=>d.name===f.dataReference!.$refText)?.dataType))throw Error('Event Modelingのdata型指定は未対応です。inline data / data参照を使用してください。');
    nodes.push({id:f.name,label:entity,description:[f.name+' · '+(kindLabel[f.modelEntityType]??f.modelEntityType),data].filter(Boolean).join('\n'),shape:'card',color:cat==='イベント'?'orange':cat==='UI / 自動処理'?'purple':'blue',line:(f.$cstNode?.range.start.line??0)+1,temporal:{order:i,lane:cat+(ns?' · '+ns:''),category:cat}});
  }
  for(const [i,f] of ast.frames.entries()){
    const current=nodes[i]!;
    // Match Mermaid: explicit sources replace inference; reset frames suppress it.
    const previous=[...nodes.slice(0,i)].reverse().find(n=>inferenceLanes[n.temporal!.order]!==inferenceLanes[i]);
    const sources=f.sourceFrames.length?f.sourceFrames.map(r=>r.$refText):f.$type==='EmResetFrame'||!previous?[]:[previous.id];
    for(const from of sources){if(!seen.has(from))throw Error(`フレーム参照 ${from} がありません。`);edges.push({from,to:f.name,label:'',style:'solid',arrow:'open',bidirectional:false,line:current.line});}
  }
  const lanes=[...new Set(nodes.map(n=>n.temporal!.lane))];
  const groups=lanes.map((lane,i)=>({id:'lane-'+i,label:lane,color:'gray' as const,line:0}));
  for(const n of nodes)n.group=groups[lanes.indexOf(n.temporal!.lane)]!.id;
  return {kind:'eventmodeling',direction:'LR',title:ast.title??'',nodes,edges,groups};
}

/** Keep event boundaries distinct from line breaks within a single event. */
export function timelineItems(n:DiagramNode):string[][] {
 return (n.temporal?.events??(n.description?[n.description]:[])).map(event=>wrapText(event,346,18));
}

/** Timeline is ordinal, not a proportional date axis. Event frames keep source order. */
export function temporalLayout(model:DiagramModel):DiagramLayout {
  const top=model.title?92:40;
  if(model.kind==='timeline'){
    let y=top,section:string|undefined;const nodes:DiagramLayoutNode[]=[],groups:DiagramLayout['groups']=[];
    for(const n of model.nodes){
      if(n.temporal?.lane!==section){section=n.temporal?.lane;y+=section?(nodes.length?62:38):0;}
      const height=Math.max(92,48+Math.max(wrapText(n.label,160,22).length*30,timelineItems(n).reduce((sum,lines)=>sum+lines.length*27+12,0)-12));
      nodes.push({node:n,x:64,y,width:620,height});
      if(section && (nodes.length===1||nodes[nodes.length-2]!.node.temporal?.lane!==section))groups.push({group:model.groups.find(g=>g.id===n.group)!,x:40,y:y-38,width:668,height:height+62});
      else if(section)groups[groups.length-1]!.height=y+height+24-groups[groups.length-1]!.y;
      y+=height+24;
    }
    return {width:748,height:y+24,nodes,groups,edges:[]};
  }
  const cats=['UI / 自動処理','コマンド / 参照モデル','イベント'];
  const lanes=[...new Set(model.nodes.map(n=>n.temporal!.lane))].sort((a,b)=>cats.findIndex(c=>a.startsWith(c))-cats.findIndex(c=>b.startsWith(c)));
  const sizes=model.nodes.map(n=>Math.max(100,50+wrapText(n.label,236).length*21+(n.description?10+wrapText(n.description,236,12).length*17:0)));
  const height=Math.max(100,...sizes)+84, width=Math.max(720,model.nodes.length*330+96);
  const nodes=model.nodes.map((n,i)=>({node:n,x:64+i*330,y:top+lanes.indexOf(n.temporal!.lane)*height+44,width:280,height:sizes[i]!}));
  const groups=lanes.map((lane,i)=>({group:model.groups.find(g=>g.label===lane)!,x:32,y:top+i*height,width:width-64,height:height-12}));
  const edges=model.edges.map(edge=>{
    const a=nodes.find(n=>n.node.id===edge.from)!,b=nodes.find(n=>n.node.id===edge.to)!;
    // Separate columns and route in the inter-lane gutter; no cards are crossed.
    const forward=a.x<b.x,start={x:forward?a.x+a.width:a.x,y:a.y+a.height/2},end={x:forward?b.x:b.x+b.width,y:b.y+b.height/2};
    const sx=start.x+(forward?18:-18),ex=end.x+(forward?-18:18);
    const gutter=top+lanes.indexOf(a.node.temporal!.lane)*height+height-22;
    if(Math.abs(a.x-b.x)===330){const mid=(start.x+end.x)/2;return {edge,points:[start,{x:mid,y:start.y},{x:mid,y:end.y},end]};}
    return {edge,points:[start,{x:sx,y:start.y},{x:sx,y:gutter},{x:ex,y:gutter},{x:ex,y:end.y},end]};
  });
  return {width,height:top+lanes.length*height+24,nodes,groups,edges};
}
