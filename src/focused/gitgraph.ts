import type {GitGraphDB} from 'mermaid/dist/diagrams/git/gitGraphTypes.js';
import type {GitGraphDiagramConfig} from 'mermaid/dist/config.type.js';
import type {DiagramModel,DiagramLayout,DiagramRenderResult} from './types.js';
import {wrapText,textWidth,FONT,segmentIntersectsBox} from './layout.js';
import {escapeXml} from './render.js';
import {safePaint} from './paint.js';
import {roundedOrthogonalPath} from './orthogonal-path.js';
const palette=['#2563a6','#0e8278','#a45f17','#8454b0','#b74668','#507c31','#536b87','#9b583f'];
/** Pass only semantic, typed options to Mermaid; never source CSS/security config. */
export function gitConfig(config:Record<string,unknown>,warn:(s:string)=>void):GitGraphDiagramConfig {
 const options:GitGraphDiagramConfig={};
 const raw=config.gitGraph;
 if(raw!==undefined&&(!raw||typeof raw!=='object'||Array.isArray(raw)))throw Error('config.gitGraphはオブジェクトです。');
 for(const [key,value] of Object.entries(raw??{})){
  if(['showBranches','showCommitLabel','parallelCommits'].includes(key)){
   if(typeof value!=='boolean')throw Error(`gitGraph.${key}はbooleanです。`);
   Object.assign(options,{[key]:value});
  }else if(key==='mainBranchName'){
   if(typeof value!=='string'||!value.trim()||value.length>200)throw Error('mainBranchNameは1〜200文字です。');
   options.mainBranchName=value;
  }else if(key==='mainBranchOrder'){
   if(typeof value!=='number'||!Number.isFinite(value))throw Error('mainBranchOrderは数値です。');options.mainBranchOrder=value;
  }else warn('Git graphのラベル回転・余白・テーマ配置はArchMapの可読性優先の表示を使います。');
 }
 if(config.themeVariables&&typeof config.themeVariables==='object'&&Object.keys(config.themeVariables).some(k=>!/^git[0-7]$/.test(k)))warn('Git graphのthemeVariablesはgit0〜git7のブランチ色のみ使用します。');
 return options;
}
export function readGitGraph(db:GitGraphDB,config:Record<string,unknown>,options:GitGraphDiagramConfig,plain:(x:unknown)=>string):Partial<DiagramModel>{
 const commits=db.getCommitsArray();
 if(commits.some((c,i)=>c.seq!==i))throw Error('コミットIDが重複しています。異なるidを指定してください。');
 const branches=db.getBranchesAsObjArray().map(b=>b.name);
 if(branches.length>200)throw Error('ブランチは200本以内にしてください。');
 const colors=[...palette];
 const vars=config.themeVariables;
 if(vars&&typeof vars==='object')for(let i=0;i<8;i++){
  const value=(vars as Record<string,unknown>)[`git${i}`];
  if(value!==undefined){if(typeof value!=='string'||!safePaint(value,true))throw Error(`git${i}には安全なCSS色を指定してください。`);colors[i]=value;}
 }
 const seen=new Set<string>();
 for(const c of commits){if(c.parents.some(p=>!seen.has(p)))throw Error('Git graphの親コミットが不正です。');seen.add(c.id);}
 return {kind:'gitgraph',direction:db.getDirection()==='TB'?'TD':db.getDirection()==='BT'?'BT':'LR',
  gitgraph:{branches:branches.map(plain),showBranches:options.showBranches!==false,showCommitLabel:options.showCommitLabel!==false,parallelCommits:options.parallelCommits===true,colors},
  nodes:commits.map(c=>({id:c.id,label:plain(c.id),shape:'card',color:'blue',line:0,description:plain(c.message),git:{branch:plain(c.branch),order:c.seq,type:c.customType??c.type,tags:c.tags.map(plain),parents:[...c.parents]}})),
  edges:commits.flatMap(c=>c.parents.map((p,i)=>({from:p,to:c.id,label:c.type===4&&i>0?'cherry-pick':'',style:c.type===4&&i>0?'dashed' as const:'solid' as const,bidirectional:false,arrow:'none' as const,line:0})))
 };
}
function labelLines(model:DiagramModel,id:string):string[]{
 const n=model.nodes.find(n=>n.id===id)!;
 return model.gitgraph!.showCommitLabel?wrapText(n.label,168,15):[];
}
function tagLines(tags:string[]):string[]{return tags.flatMap(t=>wrapText(t,168,12));}
function metrics(model:DiagramModel){
 const rows=Math.max(1,...model.nodes.map(n=>labelLines(model,n.id).length*21+tagLines(n.git!.tags).length*18));
 const title=wrapText(model.title||'Git graph',900,24);
 return {lane:Math.max(130,rows+70,...model.gitgraph!.branches.map(b=>wrapText(b,160,16).length*22+40)),step:Math.max(120,rows*2+60),top:48+title.length*30, title};
}
/** One slot per commit; only explicit parallelCommits uses parent depth. */
export function gitGraphLayout(model:DiagramModel):DiagramLayout {
 const horizontal=model.direction==='LR',g=model.gitgraph!,m=metrics(model),slots=new Map<string,number>();
 let maxSlot=0;
 model.nodes.forEach((n,i)=>{const s=g.parallelCommits?Math.max(-1,...n.git!.parents.map(p=>slots.get(p)!))+1:i;slots.set(n.id,s);maxSlot=Math.max(maxSlot,s);});
 const branchHeader=Math.max(70,...g.branches.map(b=>wrapText(b,160,16).length*21+24));
 const width=Math.max(horizontal?240+(maxSlot+1)*220:64+g.branches.length*260,...m.title.map(t=>textWidth(t,24)+56));
 const height=horizontal?m.top+g.branches.length*m.lane+32:m.top+branchHeader+(maxSlot+1)*m.step+48;
 const nodes=model.nodes.map(node=>{
  const lane=g.branches.indexOf(node.git!.branch),slot=slots.get(node.id)!;
  const x=horizontal?240+slot*220:64+lane*260;
  const y=horizontal?m.top+lane*m.lane+28:m.top+branchHeader+(model.direction==='BT'?maxSlot-slot:slot)*m.step+24;
  return {node,x:x-10,y:y-10,width:20,height:20};
 });
 const byId=new Map(nodes.map(n=>[n.node.id,n]));
 const edges=model.edges.map(edge=>{
  const a=byId.get(edge.from)!,b=byId.get(edge.to)!;
  const start={x:a.x+10,y:a.y+10},end={x:b.x+10,y:b.y+10};
  if(start.x===end.x||start.y===end.y)return {edge,points:[start,end]};
  let points=horizontal?[start,{x:end.x-110,y:start.y},{x:end.x-110,y:end.y},end]:[start,{x:start.x,y:end.y+(model.direction==='BT'?m.step/2:-m.step/2)},{x:end.x,y:end.y+(model.direction==='BT'?m.step/2:-m.step/2)},end];
  if(points.slice(1).some((p,i)=>nodes.some(n=>n!==a&&n!==b&&segmentIntersectsBox(points[i],p,n,4)))){
   const sign=model.direction==='BT'?-1:1;
   points=horizontal?[start,{x:start.x+110,y:start.y},{x:start.x+110,y:end.y-24},{x:end.x-110,y:end.y-24},{x:end.x-110,y:end.y},end]:[start,{x:start.x,y:start.y+sign*m.step/2},{x:end.x-24,y:start.y+sign*m.step/2},{x:end.x-24,y:end.y-sign*m.step/2},{x:end.x,y:end.y-sign*m.step/2},end];
  }
  points=points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
  return {edge,points};
 });
 return {width,height,nodes,edges,groups:[]};
}
export function renderGitGraph(model:DiagramModel):DiagramRenderResult {
 const start=performance.now(),layout=gitGraphLayout(model),g=model.gitgraph!,m=metrics(model),horizontal=model.direction==='LR';
 const text=(lines:string[],x:number,y:number,size:number,color='#25384b',weight=400)=>lines.map((s,i)=>`<text x="${x}" y="${y+i*(size+6)}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(s)}</text>`).join('');
 const color=(branch:string)=>g.colors[g.branches.indexOf(branch)%g.colors.length];
 const lanes=g.branches.map((branch,i)=>{
  const points=layout.nodes.filter(n=>n.node.git!.branch===branch);
  const center=horizontal?m.top+i*m.lane+28:64+i*260;
  const header=Math.max(70,...g.branches.map(b=>wrapText(b,160,16).length*21+24));
  const line=horizontal?`M 204 ${center} H ${layout.width-24}`:`M ${center} ${m.top+header} V ${layout.height-24}`;
  const label=g.showBranches?text(wrapText(branch,160,16),horizontal?28:center-16,horizontal?center+5:m.top,16,color(branch),600):'';
  return `<g class="archmap-git-branch"><title>${escapeXml(branch)} (${points.length} commits)</title><path d="${line}" fill="none" stroke="${color(branch)}" stroke-opacity="0.18" stroke-width="2" stroke-dasharray="3 6"/>${label}</g>`;
 }).join('');
 const edges=layout.edges.map(e=>{
  const dest=model.nodes.find(n=>n.id===e.edge.to)!;
  return `<path class="archmap-git-edge" d="${roundedOrthogonalPath(e.points,12)}" fill="none" stroke="${color(dest.git!.branch)}" stroke-width="2.5" stroke-linecap="round"${e.edge.style==='dashed'?' stroke-dasharray="5 5"':''}><title>${escapeXml(`${e.edge.from} → ${e.edge.to}${e.edge.label?' ('+e.edge.label+')':''}`)}</title></path>`;
 }).join('');
 const nodes=layout.nodes.map(n=>{
  const c=n.node.git!,x=n.x+10,y=n.y+10,ink=color(c.branch);
  const symbol=c.type===2?`<rect x="${x-10}" y="${y-10}" width="20" height="20" rx="4" fill="${ink}"/>`:`<circle cx="${x}" cy="${y}" r="9" fill="white" stroke="${ink}" stroke-width="3"/>`;
  const mark=c.type===1?`<path d="M ${x-4} ${y-4} l8 8 m0 -8 l-8 8" stroke="${ink}" stroke-width="2"/>`:c.parents.length>1&&c.type!==4?`<circle cx="${x}" cy="${y}" r="4" fill="${ink}"/>`:c.type===4?`<path d="M ${x-4} ${y} h8 m-4 -4 v8" stroke="${ink}" stroke-width="2"/>`:'';
  const labels=labelLines(model,n.node.id),tags=tagLines(c.tags);
  const tx=horizontal?x-84:x+20,ty=horizontal?y+33:y+5;
  const tagY=ty+labels.length*21+(labels.length?6:0);
  return `<g class="archmap-git-commit" data-node="${escapeXml(n.node.id)}"><title>${escapeXml([n.node.label,n.node.description??'',...c.tags].filter(Boolean).join('\n'))}</title>${symbol}${mark}${text(labels,tx,ty,15,'#25384b',600)}${tags.length?`<rect x="${tx-6}" y="${tagY-14}" width="180" height="${tags.length*18+8}" rx="5" fill="#edf2f7"/>${text(tags,tx,tagY,12,'#455b70')}`:''}</g>`;
 }).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeXml(model.title||'Git graph')}"><rect width="100%" height="100%" fill="white"/><g font-family="${escapeXml(FONT)}">${text(m.title,28,34,24,'#25384b',600)}${lanes}${edges}${nodes}</g></svg>`;
 return {svg,model,layout,durationMs:performance.now()-start};
}
