import mermaid from 'mermaid';
import {safeLink} from './links.js';
import {FLOW_SHAPES} from './flow-shapes.js';
import {validImageSource} from './images.js';
import type { ErDB } from 'mermaid/dist/diagrams/er/erDb.js';
import type { UsecaseDB } from 'mermaid/dist/diagrams/usecase/usecaseTypes.js';
import { load, JSON_SCHEMA } from 'js-yaml';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { StateDB, StateStmt, Stmt } from 'mermaid/dist/diagrams/state/stateDb.js';
import type { DiagramModel, DiagramNode, DiagramKind, DiagramShape, DiagramColor, DiagramFragmentEvent } from './types.js';
import { getIcon } from '../icons.js';

export const DIAGRAM_LIMITS = {sourceLength:500_000,nodes:400,groups:200,edges:1000,gridCoordinate:400,groupDepth:8} as const;
const colors = ['blue','green','orange','purple','gray'];
const kinds = ['system','layers','sequence','screens','activity','er','usecase'];
type RecordValue = Record<string, unknown>;
const record = (x: unknown): x is RecordValue => !!x && typeof x === 'object' && !Array.isArray(x);
// Mermaid's diagram databases/configuration are stateful; serialize all parsing,
// including simultaneous previews. The DB is copied before the next parse starts.
let pending: Promise<unknown> = Promise.resolve();
export function parseDiagram(source: string): Promise<DiagramModel> {
  const task = pending.then(() => parse(source)); pending = task.catch(() => {}); return task;
}
async function parse(source: string): Promise<DiagramModel> {
  const model: DiagramModel = {kind:'system',direction:'LR',title:'',nodes:[],groups:[],edges:[],diagnostics:[]};
  const error = (message: string, line = 0) => { if(model.diagnostics.length<50)model.diagnostics.push({line,severity:'error',message}); };
  const warning = (message: string) => { if(!model.diagnostics.some(d=>d.message===message)) model.diagnostics.push({line:0,severity:'warning',message}); };
  const text = (value: unknown) => {
    const s = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    // HTML is never inserted in our SVG. Decode labels to plain text only.
    const element = document.createElement('textarea'); element.innerHTML = s.replace(/<br\s*\/?\s*>/gi,'\n');
    return element.value;
  };
  const direction = (dir: string | undefined) => {
    model.direction = dir === 'LR' || dir === 'RL' || dir === 'BT' ? dir : 'TD';
  };
  const node = (id:string,label:string,shape:DiagramShape='card',group?:string): DiagramNode => ({id,label,shape,group,color:'blue',line:0});
  if(source.length>DIAGRAM_LIMITS.sourceLength){error('ソースは500,000文字以内にしてください。');return model;}
  let metadata: RecordValue = {};
  try {
    const metaLines=source.split('\n').map((value,index)=>({value,index})).filter(x=>/^\s*%%\s*archmap:/.test(x.value));
    if(metaLines.length>1) throw new Error('%% archmap: は1文書に1行だけ指定してください。');
    if(metaLines[0]){ const value=JSON.parse(metaLines[0].value.replace(/^\s*%%\s*archmap:\s*/,''));if(!record(value))throw new Error('archmap の補助設定はJSONオブジェクトです。');metadata=value; }
    for(const key of Object.keys(metadata)) if(!['view','style','nodes','actions'].includes(key)) error(`未対応の補助設定: ${key}`);
    if(metadata.view!==undefined && !kinds.includes(String(metadata.view)))error('view が不正です。');
    if(metadata.style!==undefined && !['cards','icons'].includes(String(metadata.style)))error('style は cards / icons です。');
    let rendererConfig:RecordValue={};
    let mermaidSource=source;
    const front=/^\s*---\s*\n([\s\S]*?)\n---/.exec(source);
    if(front){
      const v=load(front[1],{schema:JSON_SCHEMA});
      if(!record(v))error('frontmatter はオブジェクトで指定してください。');
      else {
        if(v.title!==undefined&&typeof v.title!=='string')error('title は文字列で指定してください。');
        else if(typeof v.title==='string')model.title=v.title;
        if(v.config!==undefined&&!record(v.config))error('config はオブジェクトで指定してください。');
        else if(record(v.config))rendererConfig=v.config;
        if(Object.keys(v).some(k=>!['title','config'].includes(k)))warning('frontmatter の追加属性はArchMapの表示には使用しません。');
      }
      mermaidSource=source.slice(front[0].length);
    }
    mermaidSource=mermaidSource.replace(/%%\{\s*(?:init|initialize)\s*:\s*([\s\S]*?)\}%%/g,(_,raw:string)=>{
      const value=load(raw,{schema:JSON_SCHEMA});if(!record(value))error('init は設定オブジェクトで指定してください。');else rendererConfig={...rendererConfig,...value};return '';
    });
    // Source-supplied settings must not change parser security or inject CSS.
    // Configuration affecting ArchMap's output is applied explicitly below.
    if(Object.keys(rendererConfig).some(k=>k!=='sequence') || record(rendererConfig.sequence)&&Object.keys(rendererConfig.sequence).some(k=>k!=='showSequenceNumbers'))warning('Mermaidのテーマ・レイアウト設定はArchMapのテーマと配置に統一します。');
    if(model.diagnostics.some(d=>d.severity==='error'))return model;
    const body=mermaidSource.replace(/^\s*%%.*$/gm,'').trim();
    if(!/^(flowchart\b|graph\b|sequenceDiagram\b|stateDiagram-v2\b|erDiagram\b|usecase-beta\b)/.test(body)){error('対応するMermaid構文は flowchart / graph / sequenceDiagram / stateDiagram-v2 / erDiagram / usecase-beta です。');return model;}
    if(/(?:^|;)\s*click\s+/m.test(body)){error('click / リンク操作は未対応です。');return model;}
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',maxTextSize:500_000,maxEdges:1000,flowchart:{htmlLabels:false},suppressErrorRendering:true});
    const diagram=await mermaid.mermaidAPI.getDiagramFromText(mermaidSource);
    model.title=text(diagram.db.getDiagramTitle?.()) || model.title;
    if(diagram.type.startsWith('flowchart')) {
      const db=diagram.db as FlowDB;
      model.kind=(metadata.view as DiagramKind) || 'system'; direction(db.getDirection());
      if(!['system','layers','screens','activity'].includes(model.kind))error('flowchart の view は system / layers / screens / activity です。');
      const groups=db.getSubGraphs(); const vertices=db.getVertices();
      if(db.getClasses().size)warning('Mermaid の style / class の装飾は使わず、ArchMapのテーマで描画します。');
      const parent=(id:string)=>groups.find(g=>g.nodes.includes(id))?.id;
      model.groups=groups.map(g=>({id:g.id,label:text(g.title),parent:parent(g.id),collapsed:g.metadata?.view==='collapsed',direction:g.dir==='TB'?'TD':g.dir as DiagramModel['direction']|undefined,color:'blue',line:0}));
      for(const g of groups)if(g.metadata&&Object.keys(g.metadata).some(k=>!['view','label'].includes(k)))warning('subgraphの装飾はArchMapのテーマで表示します。');
      const shapes:Record<string,DiagramShape>={square:'card',rect:'card',round:'card',stadium:'start',circle:'start',doublecircle:'end',cylinder:'database',diamond:'decision',diam:'decision',rounded:'card'};
      for(const v of vertices.values()) {
        if(model.groups.some(g=>g.id===v.id))continue;
        const flowShape=FLOW_SHAPES[v.type||'square'];
        const shape=v.img?'card':shapes[v.type || 'square'] ?? (flowShape==='diam'?'decision':flowShape==='cyl'||flowShape==='lin-cyl'?'database':flowShape==='fork'?'fork':flowShape?'card':undefined); if(!shape)error(`ノード ${v.id}: 形状 ${v.type} は未対応です。`);
        const n=node(v.id,text(v.text || v.id),shape || 'card',parent(v.id));
        if(!v.img)n.flowShape=flowShape;
        if(v.icon)n.icon=getIcon(v.icon)?v.icon:v.icon.replace(':','/');
        if(v.img) {
          if(!validImageSource(v.img))error(`ノード ${v.id}: 画像URLの形式が未対応です。`);
          if([v.assetWidth,v.assetHeight].some(value=>value!==undefined&&(!Number.isFinite(value)||value<=0||value>4096)))error(`ノード ${v.id}: 画像サイズは0より大きく4096以下で指定してください。`);
          n.image={src:v.img,width:v.assetWidth,height:v.assetHeight,position:v.pos??'b',constraint:v.constraint??'off'};
        }
        if(v.link||v.haveCallback)error('click / リンク操作は未対応です。');
        if(v.styles.length||v.classes.length)warning('Mermaid の style / class の装飾は使わず、ArchMapのテーマで描画します。');
        if(v.labelType==='markdown' && /[*`]/.test(v.text || ''))warning('Markdownラベルの装飾は未対応です。文字列として表示します。');
        model.nodes.push(n);
      }
      for(const e of db.getEdges()){
        if(!['arrow_point','double_arrow_point','arrow_open','arrow_circle','double_arrow_circle','arrow_cross','double_arrow_cross'].includes(e.type || ''))error(`接続 ${e.start} → ${e.end}: 矢印 ${e.type} は未対応です。`);
        if(e.style?.length||e.animate||e.animation)warning('接続のstyle・アニメーションはArchMapの表示に統一します。');
        model.edges.push({invisible:e.stroke==='invisible',thick:e.stroke==='thick',sourceMarker:e.type==='double_arrow_circle'?'circle':e.type==='double_arrow_cross'?'cross':undefined,targetMarker:e.type?.includes('circle')?'circle':e.type?.includes('cross')?'cross':undefined,from:e.start,to:e.end,label:text(e.text),style:e.stroke==='dotted'?'dashed':'solid',bidirectional:e.type==='double_arrow_point',arrow:e.type==='arrow_open'?'none':'open',line:0});
      }
    } else if(diagram.type==='er') {
      const db=diagram.db as ErDB; model.kind='er'; direction(db.getDirection());
      if(metadata.view && metadata.view!=='er')error('erDiagram の view は er のみです。');
      const groups=db.getSubGraphs();
      const entityIds=new Map([...db.getEntities()].map(([name,e])=>[e.id,name]));
      model.groups=groups.map(g=>({id:g.id,label:text(g.title),color:'blue',line:0,parent:groups.find(p=>p.nodes.includes(g.id))?.id}));
      for(const [name,entity] of db.getEntities()) {
        model.nodes.push({...node(name,text(entity.alias || entity.label), 'card',groups.find(g=>g.nodes.includes(entity.id)||g.nodes.includes(entity.label))?.id),
          attributes:entity.attributes.map(a=>({name:text(a.name),type:text(a.type),keys:[...a.keys],comment:text(a.comment)}))});
      }
      const cards:Record<string,string>={ONLY_ONE:'one',ZERO_OR_ONE:'zero-one',ONE_OR_MORE:'many',ZERO_OR_MORE:'zero-many'};
      for(const r of db.getRelationships()) {
        if(!cards[r.relSpec.cardA] || !cards[r.relSpec.cardB])error('この多重度は未対応です。');
        model.edges.push({from:entityIds.get(r.entityA)??r.entityA,to:entityIds.get(r.entityB)??r.entityB,label:text(r.roleA),style:r.relSpec.relType==='IDENTIFYING'?'solid':'dashed',bidirectional:false,arrow:'none',sourceMarker:cards[r.relSpec.cardB],targetMarker:cards[r.relSpec.cardA],line:0});
      }
      if(db.getClasses().size || [...db.getEntities().values()].some(e=>e.cssStyles?.length))warning('ER図の装飾はArchMapのテーマに統一します。');
    } else if(diagram.type==='usecase') {
      const db=diagram.db as UsecaseDB;model.kind='usecase';direction(db.getDirection());
      if(metadata.view && metadata.view!=='usecase')error('usecase-beta の view は usecase のみです。');
      for(const a of db.getActors().values()) {
        model.nodes.push({...node(a.id,text(a.label),'card',a.parentId),role:'actor',icon:a.icon?.replace(':','/')||'user',description:a.stereotype?`«${text(a.stereotype)}»`:undefined});
        if(a.business)error('business actor は未対応です。');
        if(a.type!=='normal'&&a.type!=='icon')warning('アクターの形状はArchMapのアクターカードに統一します。');
      }
      for(const u of db.getUseCases().values()) {
        model.nodes.push({...node(u.id,text(u.label),u.shape==='rect'?'card':'start',u.parentId),role:'usecase',description:u.stereotype?`«${text(u.stereotype)}»`:undefined});
        if(u.business)error('business usecase は未対応です。');
      }
      for(const g of db.getSystemBoundaries().values()) {
        model.groups.push({id:g.id,label:text(g.label),color:'blue',line:0});
        if(g.type==='package')warning('package境界は通常のシステム境界として表示します。');
      }
      for(const r of db.getRelationships()) {
        const reverse=[1,5,6].includes(r.arrowType);
        model.edges.push({relationship:r.type,from:reverse?r.target:r.source,to:reverse?r.source:r.target,
          label:r.type==='include'||r.type==='extend'?`«${r.type}»`:text(r.label),
          style:r.type==='include'||r.type==='extend'?'dashed':'solid',bidirectional:false,
          arrow:r.type==='generalization'||r.arrowType>=2?'none':'open',
          targetMarker:r.type==='generalization'?'generalization':[3,5].includes(r.arrowType)?'circle':[4,6].includes(r.arrowType)?'cross':undefined,line:0});
      }
      for(const note of db.getNotes().values()) {
        model.nodes.push({...node(note.id,text(note.label),'note',model.nodes.find(n=>n.id===note.target)?.group),color:'orange'});
        model.edges.push({from:note.target,to:note.id,label:'',style:'dashed',bidirectional:false,arrow:'none',line:0});
      }
      if(db.getJsonNodes().size)error('ユースケース図のJSONノードは未対応です。');
      if(db.getClassDefs().size || [...db.getActors().values(),...db.getUseCases().values(),...db.getRelationships()].some(e=>e.styles.length||e.classes.length))warning('ユースケース図の装飾はArchMapのテーマに統一します。');
    } else if(diagram.type==='sequence') {
      const db=diagram.db as SequenceDB;model.kind='sequence';model.direction='LR';
      if(metadata.view && metadata.view!=='sequence')error('sequenceDiagram の view は sequence のみです。');
      for(const [id,a] of db.getActors()){
        if(!['actor','participant','database','boundary','control','entity','collections','queue'].includes(a.type))error(`参加者の種類 ${a.type} は未対応です。`);
        const links=Object.entries(a.links).flatMap(([label,value])=>{const href=safeLink(value);if(!href){warning(`参加者 ${id}: 安全なURLではないリンクを省略しました。`);return [];}return [{label:text(label),href}];});
        const description=Object.entries(a.properties).map(([key,value])=>`${text(key)}: ${text(typeof value==='object'?JSON.stringify(value):value)}`).join('\n');
        model.nodes.push({...node(id,text(a.description || id)),participantType:a.type,links,description:description||undefined,icon:a.type==='actor'?'user':a.type==='database'?'database':undefined});
      }
      for(const [i,box] of db.getBoxes().entries()) {
        const id=`sequence-box-${i}`;
        model.groups.push({id,label:text(box.name),color:'blue',line:0});
        for(const n of model.nodes) if(box.actorKeys.includes(n.id))n.group=id;
      }
      for(const n of model.nodes) {n.createdAt=db.getCreatedActors().get(n.id);n.destroyedAt=db.getDestroyedActors().get(n.id);}

      model.activationEvents=[];model.fragmentEvents=[];model.noteEvents=[];
      const events:Record<number,DiagramFragmentEvent['action']>={10:'loop',11:'end',12:'alt',13:'else',14:'end',15:'opt',16:'end',19:'par',20:'and',21:'end',22:'rect',23:'end',27:'critical',28:'option',29:'end',30:'break',31:'end',32:'par'};
      let sequenceNumber:number|undefined=record(rendererConfig.sequence)&&rendererConfig.sequence.showSequenceNumbers===true?1:undefined,step=1;
      for(const [i,msg] of db.getMessages().entries()){
        const line=i+1, type=msg.type ?? -1;
        if(type===26){if(typeof msg.message==='object'){sequenceNumber=msg.message.visible?msg.message.start:undefined;step=msg.message.step;}continue;}
        if(type===2){model.noteEvents.push({from:msg.from!,to:msg.to!,label:text(msg.message),placement:Number(msg.placement)===0?'left':Number(msg.placement)===1?'right':'over',afterEdge:model.edges.length,line});continue;}
        if(type===59||type===60)continue;
        if(type===17||type===18){model.activationEvents.push({action:type===18?'deactivate':'activate',node:msg.from!,afterEdge:model.edges.length,line});continue;}
        if(events[type]){const swatch=document.createElement('span');if(type===22)swatch.style.color=text(msg.message);model.fragmentEvents.push({action:events[type],fill:type===22?swatch.style.color||'#e8f0fa':undefined,label:text(msg.message),afterEdge:model.edges.length,line});continue;}
        if(![0,1,3,4,5,6,24,25,33,34,41,42,43,44,45,46,47,48,51,52,53,54,55,56,57,58].includes(type)){error(`sequence のメッセージ/枠 (種別 ${type}) は未対応です。この矢印形式は利用できません。`);continue;}
        const half=type>=41,variant=type>=51?type-10:type;
        const reverse=half&&variant>=45;
        const marker=half?`${[41,42,45,46].includes(variant)?'solid':'open'}-half-${[41,43,46,48].includes(variant)?'top':'bottom'}`:undefined;
        const label=(sequenceNumber===undefined?'':`${sequenceNumber}. `)+text(msg.message);if(sequenceNumber!==undefined)sequenceNumber+=step;
        model.edges.push({from:msg.from!,to:msg.to!,label,central:msg.centralConnection===59?'target':msg.centralConnection===60?'source':msg.centralConnection===61?'both':undefined,sourceMarker:reverse?marker:undefined,targetMarker:half&&!reverse?marker:[3,4].includes(type)?'cross':undefined,style:[1,4,6,25,34,51,52,53,54,55,56,57,58].includes(type)?'dashed':'solid',bidirectional:[33,34].includes(type),arrow:half?'none':[0,1,33,34].includes(type)?'filled':[5,6].includes(type)?'none':'open',line});
      }
    } else if(diagram.type.startsWith('state')) {
      const db=diagram.db as StateDB;model.kind=(metadata.view as DiagramKind)||'screens';direction(db.getDirection());
      if(!['screens','activity'].includes(model.kind))error('stateDiagram-v2 の view は screens / activity です。');
      // getData() is Mermaid's renderer model: adding a description can turn a
      // semantic choice/fork/join into a generic rect there. Preserve the type
      // from the parsed state declarations, including nested state documents.
      const specialStates = new Map<string, DiagramShape>();
      const stateDirections = new Map<string,DiagramModel['direction']>();
      const collectState = (state: StateStmt): void => {
        const shape = {choice:'decision',fork:'fork',join:'join'}[state.type as 'choice'|'fork'|'join'] as DiagramShape | undefined;
        if(shape) {
          specialStates.set(state.id, shape);
          if(/^".*"\s+as\s+/.test(state.id)) error('判断・fork・join は state ID <<choice>> のように宣言し、表示名は別行の ID : 表示名 で指定してください。');
        }
        for(const statement of state.doc || []) {
          if(statement.stmt==='dir')stateDirections.set(state.id,statement.value==='TB'?'TD':statement.value as DiagramModel['direction']);
          else if(statement.stmt==='state'||statement.stmt==='default') collectState(statement);
          else if(statement.stmt==='relation') { collectState(statement.state1); collectState(statement.state2); }
        }
      };
      for(const state of db.getStates().values()) collectState(state);
      // Mermaid 12 keeps the first implicit reference in getStates(). A later
      // typed declaration remains in the parsed document, but not that map.
      // Isolate this version-pinned database detail here; never reparse with regex.
      const rootDoc = (db as unknown as {rootDoc?: Stmt[]}).rootDoc;
      if (Array.isArray(rootDoc)) collectState({id:'root',stmt:'state',type:'default',doc:rootDoc});
      const data=db.getData();
      for(const v of data.nodes){
        if(v.shape==='noteGroup')continue;
        if(v.isGroup){model.groups.push({id:v.id,label:text(v.label),color:'blue',parent:v.parentId,concurrent:v.shape==='divider',direction:stateDirections.get(v.id),line:0});continue;}
        const shapes:Record<string,DiagramShape>={rect:'card',rectWithTitle:'card',roundedWithTitle:'card',stateStart:'start',stateEnd:'end',choice:'decision',fork:'fork',join:'join',note:'note'};
        if(!shapes[v.shape])error(`状態 ${v.id}: 形状 ${v.shape} は未対応です。`);
        const label=v.shape==='stateStart'?'開始':v.shape==='stateEnd'?'終了':text(v.label || v.id);
        const n=node(v.id,label,specialStates.get(v.id)||shapes[v.shape]||'card',v.parentId);
        if(v.shape==='note') {
          const link=data.edges.find(e=>e.end===v.id||e.start===v.id);
          n.noteTarget=link?.start===v.id?link.end:link?.start;n.notePosition=v.position==='left of'?'left':'right';
          n.group=data.nodes.find(target=>target.id===n.noteTarget)?.parentId;n.color='orange';
        }
        model.nodes.push(n);
        if(v.cssStyles.length||v.cssCompiledStyles?.length)warning('状態の装飾はArchMapのテーマで描画します。');
      }
      for(const e of data.edges)model.edges.push({from:e.start,to:e.end,label:text(e.label),style:e.pattern==='dashed'?'dashed':'solid',arrow:e.arrowhead==='none'?'none':'open',bidirectional:false,line:0});
      if(db.getLinks().size)error('状態の click / リンク操作は未対応です。');
    }
    model.style=(metadata.style as 'cards'|'icons')||'cards';
    if(metadata.nodes!==undefined){
      if(!record(metadata.nodes))error('nodes はノードIDをキーにしたオブジェクトです。');
      else for(const [id,opts] of Object.entries(metadata.nodes)){
        const n=model.nodes.find(n=>n.id===id);if(!n){error(`補助設定のノード ${id} がありません。`);continue;}
        if(!record(opts)){error(`nodes.${id} はオブジェクトです。`);continue;}
        for(const [key,value] of Object.entries(opts)){
          if(key==='at' && Array.isArray(value)&&value.length===2&&value.every(v=>Number.isInteger(v)&&v>=1&&v<=400))n.at=value as [number,number];
          else if(key==='icon' && typeof value==='string')n.icon=value;
          else if(key==='description' && typeof value==='string')n.description=value;
          else if(key==='color' && colors.includes(String(value)))n.color=value as DiagramColor;
          else if(key==='shape' && value==='modal' && model.kind==='screens')n.shape='modal';
          else error(`nodes.${id}.${key} は未対応、または値が不正です。`);
        }
      }
    }
    if(metadata.actions!==undefined){
      if(model.kind!=='screens'||!Array.isArray(metadata.actions)){error('actions は screens 用の配列です。');}
      else {model.screenActions=[];for(const action of metadata.actions){
        if(!record(action)||typeof action.node!=='string'||typeof action.label!=='string'||!action.label.trim()){error('操作には node と空でない label が必要です。');continue;}
        const owner=model.nodes.find(n=>n.id===action.node);
        if(!owner||!['card','modal'].includes(owner.shape)){error('操作の node は画面またはモーダルです。');continue;}
        if(Object.keys(action).some(k=>!['node','label','state','effect','when','close'].includes(k))||['state','effect','when'].some(k=>action[k]!==undefined&&(typeof action[k]!=='string'||!String(action[k]).trim()))||(action.close!==undefined&&(action.close!==true||owner.shape!=='modal'))||['state','effect','close'].filter(k=>action[k]!==undefined).length>1){error('操作の state / effect / when / close の値が不正です。');continue;}
        model.screenActions.push({node:action.node,label:action.label,state:action.state as string|undefined,effect:action.effect as string|undefined,when:action.when as string|undefined,close:action.close as boolean|undefined,line:0});
      }}
    }
    if(model.nodes.length>400||model.groups.length>200||model.edges.length>1000||(model.screenActions?.length||0)>1000)error('上限は400ノード・200グループ・1,000接続・1,000操作です。');
    const ids=new Set([...model.nodes.map(n=>n.id), ...model.groups.map(g=>g.id)]),cells=new Set<string>();
    for(const n of model.nodes){if(n.icon&&!getIcon(n.icon))error(`未登録アイコン: ${n.icon}`);if(n.at){const cell=n.at.join(',');if(cells.has(cell))error(`配置 ${cell} が重複しています。`);cells.add(cell);}}
    for(const edge of model.edges)if(!ids.has(edge.from)||!ids.has(edge.to))error('接続先のノードまたはグループが存在しません。');
    for(const group of model.groups){const seen=new Set([group.id]);let p=group.parent;while(p){if(seen.has(p)){error('グループの循環は未対応です。');break;}seen.add(p);p=model.groups.find(g=>g.id===p)?.parent;}if(seen.size>8)error('グループの入れ子は8段までです。');}
    if(model.style==='icons' && !['system','layers'].includes(model.kind))error('icons 表示は system / layers 専用です。');
    if(['sequence','layers'].includes(model.kind) && model.nodes.some(n=>n.at))warning('この表示では at を使わず、参加者またはグループの順序で配置します。');
    if(model.nodes.some(n=>n.at)&&model.groups.some(g=>g.direction))warning('手動配置 at を優先するため、グループのdirectionは自動配置には使いません。');
    let fragmentDepth=0;const activations=new Map<string,number>();
    for(const e of model.fragmentEvents || []){if(e.action==='end')fragmentDepth--;else if(!['else','and','option'].includes(e.action))fragmentDepth++;if(fragmentDepth>8)error('フラグメントの入れ子は8段までです。');}
    for(const e of model.activationEvents || []){const depth=(activations.get(e.node)||0)+(e.action==='activate'?1:-1);activations.set(e.node,depth);if(depth<0||depth>16)error('活性区間の対応が不正、または16段を超えています。');}
    if([...activations.values()].some(d=>d!==0))error('活性区間は deactivate または - で閉じてください。');
    if((model.noteEvents?.length||0)>1000)error('Noteは1,000件までです。');
    if((model.fragmentEvents?.length||0)>1000 || (model.activationEvents?.length||0)>2000)error('フラグメントは1,000文、活性区間は2,000文までです。');
    if(!model.nodes.length&&!model.groups.length)error('ノードまたは参加者を記述してください。');
    return model;
  }catch(e){error(e instanceof Error?e.message:String(e));return model;}
}
