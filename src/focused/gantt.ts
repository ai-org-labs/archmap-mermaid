import dayjs from 'dayjs';
import {timeFormat} from 'd3-time-format';
import {timeTicks,timeMillisecond,timeSecond,timeMinute,timeHour,timeDay,timeWeek,timeMonth,timeYear,timeMonday,timeTuesday,timeWednesday,timeThursday,timeFriday,timeSaturday,timeSunday} from 'd3-time';
import type {CountableTimeInterval} from 'd3-time';
import type GanttDB from 'mermaid/dist/diagrams/gantt/ganttDb.js';
import type {DiagramModel,DiagramNode,DiagramLayout,DiagramLayoutNode,DiagramEdge,DiagramRenderResult} from './types.js';
import {wrapText,FONT,segmentIntersectsBox} from './layout.js';
import {escapeXml} from './render.js';
import {safePaint} from './paint.js';

interface Task {
 id:string;task:string;section:string;startTime:Date;endTime:Date;renderEndTime?:Date;
 active?:boolean;done?:boolean;crit?:boolean;milestone?:boolean;vert?:boolean;
 raw:{startTime:{type:string;startData?:string;id?:string};endTime:{data:string}};
}
const DAY=86400000;
const defaults:Record<string,string>={taskBkgColor:'#427ba6',taskBorderColor:'#31688e',activeTaskBkgColor:'#138478',activeTaskBorderColor:'#086c61',doneTaskBkgColor:'#94a3b8',doneTaskBorderColor:'#718096',critBkgColor:'#ca4b53',critBorderColor:'#ac3541',taskTextColor:'#25384b',gridColor:'#e2e8ef',todayLineColor:'#cb6339'};
const refs=(s:string|undefined,keyword:string)=>(s??'').trim().startsWith(keyword+' ')?s!.trim().slice(keyword.length).trim().split(/\s+/):[];
/** Use Mermaid's calendar arithmetic, never reconstruct dates from graph layout. */
export function readGantt(db:typeof GanttDB,config:Record<string,unknown>,plain:(x:unknown)=>string,warn:(s:string)=>void):Partial<DiagramModel>{
 const tasks=db.getTasks() as Task[];
 const ids=new Set<string>();for(const t of tasks){if(ids.has(t.id))throw Error(`ガントのタスクID ${t.id} が重複しています。`);ids.add(t.id);}
 const dependencies:DiagramEdge[]=[];
 const schedule=new Map<string,string[]>();
 for(const t of tasks){
  const after=refs(t.raw.startTime.startData,'after');
  const previous=t.raw.startTime.type==='prevTaskEnd'&&t.raw.startTime.id?[t.raw.startTime.id]:[];
  const until=refs(t.raw.endTime.data,'until');
  for(const id of [...after,...previous,...until])if(!ids.has(id))throw Error(`ガント ${t.id}: 参照先 ${id} が存在しません。`);
  schedule.set(t.id,[...after,...previous,...until]);
  for(const id of [...new Set([...after,...previous])])dependencies.push({from:id,to:t.id,label:'after',style:'solid',arrow:'open',bidirectional:false,line:0});
  for(const id of [...new Set(until)])dependencies.push({from:t.id,to:id,label:'until',style:'dashed',arrow:'open',bidirectional:false,line:0});
 }
 const visited=new Set<string>(),visiting=new Set<string>();
 const visit=(id:string)=>{if(visiting.has(id))throw Error('ガントの日付依存に循環があります。');if(visited.has(id))return;visiting.add(id);for(const dep of schedule.get(id)??[])visit(dep);visiting.delete(id);visited.add(id);};
 for(const id of ids)visit(id);
 const groups:DiagramModel['groups']=[];
 const nodes:DiagramNode[]=tasks.map(t=>{
  const start=+t.startTime,end=+(t.renderEndTime??t.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error(`ガント ${t.id}: 日付または依存関係を解決できません。開始日・終了日を確認してください。`);
  let group=groups.find(g=>g.label===plain(t.section));
  if(t.section&&!group){group={id:'gantt-section-'+groups.length,label:plain(t.section),color:'gray',line:0};groups.push(group);}
  return {id:t.id,label:plain(t.task),shape:'card',color:'blue',group:group?.id,line:0,gantt:{start,end,milestone:!!t.milestone,active:!!t.active,done:!!t.done,critical:!!t.crit,vertical:!!t.vert}};
 });
 const theme={...defaults};
 if(config.themeVariables&&typeof config.themeVariables==='object')for(const [k,v] of Object.entries(config.themeVariables)){
  if(k in defaults){if(typeof v!=='string'||!safePaint(v,true))throw Error(`themeVariables.${k}: 安全なCSS色を指定してください。`);theme[k]=v;}
  else warn('ガントの未対応themeVariablesはArchMapの既定配色を使います。');
 }
 if(config.gantt&&typeof config.gantt==='object'&&Object.keys(config.gantt).length)warn('ガントの行高・余白・compact等の配置設定は可読性を優先してArchMapが決定します。');
 const excluded:Array<[number,number]>=[];
 if(nodes.length){
  let d=dayjs(Math.min(...nodes.map(n=>n.gantt!.start))).startOf('day');const end=Math.max(...nodes.map(n=>n.gantt!.end));
  if(end-d.valueOf()>DAY*366*100)throw Error('ガントの表示期間は100年以内にしてください。');
  if(db.getExcludes().length)while(d.valueOf()<end){const next=d.add(1,'day');if(db.isInvalidDate(d,db.getDateFormat(),db.getExcludes(),db.getIncludes())){const last=excluded[excluded.length-1];if(last&&last[1]===d.valueOf())last[1]=next.valueOf();else excluded.push([d.valueOf(),next.valueOf()]);}d=next;}
 }
 const tickInterval=db.getTickInterval() as string|undefined;
 if(tickInterval&&!/^\s*[1-9]\d*(millisecond|second|minute|hour|day|week|month|year)s?\s*$/.test(tickInterval))throw Error('tickInterval は 1day / 1week / 1month 等で指定してください。');
 if(db.getTodayMarker()&&!['off','on'].includes(db.getTodayMarker()))warn('todayMarkerの線はthemeVariables.todayLineColorで配色します。任意のCSS指定は使用しません。');
 return {kind:'gantt',direction:'LR',nodes,groups,edges:dependencies,gantt:{axisFormat:db.getAxisFormat(),tickInterval,weekday:db.getWeekday(),todayMarker:db.getTodayMarker(),excluded,theme}};
}

/** Optional presentation table, not a second scheduling language. */
export function readGanttColumns(model:DiagramModel,value:unknown):void {
 const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!record(value)||Object.keys(value).some(k=>!['columns','rows'].includes(k))||!Array.isArray(value.columns)||value.columns.length>6)throw Error('gantt.columns は追加列の配列（最大6列）です。');
 const keys=new Set<string>();
 const columns=value.columns.map(c=>{
  if(!record(c)||Object.keys(c).some(k=>!['key','label','width'].includes(k))||typeof c.key!=='string'||! /^[a-zA-Z][a-zA-Z0-9_]*$/.test(c.key)||['__proto__','constructor','prototype','task'].includes(c.key)||keys.has(c.key)||typeof c.label!=='string'||!c.label.trim()||c.label.length>80||c.width!==undefined&&(typeof c.width!=='number'||!Number.isFinite(c.width)||c.width<80||c.width>240))throw Error('列には一意のkey、label、任意のwidth（80〜240）を指定してください。');
  keys.add(c.key);return {key:c.key,label:c.label,width:typeof c.width==='number'?c.width:140};
 });
 if(columns.reduce((sum,c)=>sum+c.width,0)>960)throw Error('追加列の合計幅は960以下にしてください。');
 const rows:Record<string,Record<string,string>>=Object.create(null);
 if(value.rows!==undefined){if(!record(value.rows))throw Error('gantt.rows はタスクIDごとの値です。');for(const [id,row] of Object.entries(value.rows)){
  if(!model.nodes.some(n=>n.id===id)||!record(row))throw Error(`gantt.rows.${id}: タスクIDまたは値が不正です。`);
  rows[id]=Object.create(null);for(const [key,cell] of Object.entries(row)){
   if(!keys.has(key)||['id','start','end','duration','status'].includes(key)||!['string','number','boolean'].includes(typeof cell)||typeof cell==='number'&&!Number.isFinite(cell)||String(cell).length>500)throw Error(`gantt.rows.${id}.${key}: 未定義列・計算列への上書き、または値が不正です。`);
   rows[id][key]=String(cell);
  }
 }}
 model.gantt!.columns=columns;model.gantt!.rows=rows;
}
const statusText=(n:DiagramNode)=>[n.gantt!.critical?'重要':'',n.gantt!.done?'完了':n.gantt!.active?'進行中':'予定'].filter(Boolean).join(' · ');
const datePattern=(model:DiagramModel)=>model.nodes.some(n=>[n.gantt!.start,n.gantt!.end].some(t=>{const d=new Date(t);return d.getHours()||d.getMinutes()||d.getSeconds();}))?'%Y/%m/%d %H:%M':'%Y/%m/%d';
function cellText(model:DiagramModel,n:DiagramNode,key:string):string {
 const t=n.gantt!,format=timeFormat(datePattern(model));
 if(key==='id')return n.id;
 if(key==='start'||key==='end')return format(new Date(t[key]));
 if(key==='status')return statusText(n);
 if(key==='duration'){const minutes=(t.end-t.start)/60000;return minutes<60?`${+minutes.toFixed(2)}分`:minutes%60?`${Math.floor(minutes/60)}時間${+(minutes%60).toFixed(2)}分`:`${minutes/60}時間`;}
 return model.gantt!.rows?.[n.id]?.[key]??'—';
}
function tableColumns(model:DiagramModel){let x=340;return (model.gantt!.columns??[]).map(c=>{const column={...c,x};x+=c.width;return column;});}

function frame(model:DiagramModel){
 const times=model.nodes.flatMap(n=>[n.gantt!.start,n.gantt!.end]);
 const min=Math.min(...times),max=Math.max(...times),span=Math.max(max-min,60000),pad=span*.035;
 const left=356+(model.gantt!.columns??[]).reduce((sum,c)=>sum+c.width,0),width=1060,top=38+wrapText(model.title||'Gantt chart',left+width-64,26).length*34+Math.max(0,...(model.gantt!.columns??[]).map(c=>(wrapText(c.label,c.width-24,13).length-1)*19));
 return {min:min-pad,max:Math.max(max,min+60000)+pad,span:Math.max(max,min+60000)-min+2*pad,left,width,top};
}
function axisScale(model:DiagramModel){const f=frame(model);return (time:number)=>f.left+(time-f.min)/f.span*f.width;}
export function ganttLayout(model:DiagramModel):DiagramLayout{
 const f=frame(model),x=axisScale(model);let y=f.top+48,group:string|undefined;
 const nodes:DiagramLayoutNode[]=[],groups:DiagramLayout['groups']=[];
 for(const n of model.nodes){
  if(n.group!==group){group=n.group;if(group){const g=model.groups.find(g=>g.id===group)!;const lines=wrapText(g.label,f.left+f.width-64,16);const h=lines.length*23+18;groups.push({group:g,x:24,y,width:f.left+f.width-12,height:h});y+=h;}}
  const rowHeight=Math.max(68,wrapText(n.label,290,16).length*22+52,...tableColumns(model).map(c=>wrapText(cellText(model,n,c.key),c.width-24,14).length*20+32)),t=n.gantt!;
  const midpoint=(x(t.start)+x(t.end))/2,w=t.milestone?18:Math.max(1,x(t.end)-x(t.start));
  nodes.push({node:n,x:t.milestone?midpoint-9:x(t.start),y:y+12,width:w,height:28});y+=rowHeight;
 }
 // Route through row gutters. Try a nearby clear vertical track first, then a reserved outside track.
 const edges=model.edges.map((edge,i)=>{
  const a=nodes.find(n=>n.node.id===edge.from)!,b=nodes.find(n=>n.node.id===edge.to)!;
  const down=b.y>a.y,sy=down?a.y+a.height+8:a.y-8,ty=down?b.y-8:b.y+b.height+8;
  const sx=a.x+a.width,tx=b.x+Math.min(12,b.width/2),tip={x:tx,y:down?b.y:b.y+b.height};
  const candidates=[sx+8,tx,sx-12,b.x-12,...nodes.flatMap(n=>[n.x-12,n.x+n.width+12]),f.left+f.width+18+(i%12)*5];
  const track=candidates.find(cx=>cx>=f.left-18&&!nodes.some(n=>segmentIntersectsBox({x:cx,y:sy},{x:cx,y:ty},{x:n.x-4,y:n.y-3,width:n.width+8,height:n.height+6})))??f.left+f.width+24;
  const raw=[{x:sx,y:a.y+a.height/2},{x:sx+8,y:a.y+a.height/2},{x:sx+8,y:sy},{x:track,y:sy},{x:track,y:ty},{x:tx,y:ty},tip];
  const points:typeof raw=[];for(const p of raw){if(points.length&&points[points.length-1].x===p.x&&points[points.length-1].y===p.y)continue;points.push(p);while(points.length>2){const [a,b,c]=points.slice(-3);if(a.x===b.x&&b.x===c.x||a.y===b.y&&b.y===c.y)points.splice(points.length-2,1);else break;}}
  return {edge,points};
 });
 return {width:f.left+f.width+112,height:y+100,nodes,edges,groups};
}
const label=(s:string,x:number,y:number,size=14,fill='#25384b',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${escapeXml(fill)}" font-weight="${weight}">${escapeXml(s)}</text>`;
const lines=(s:string,x:number,y:number,width:number,size:number,fill='#25384b',weight=400)=>wrapText(s,width,size).map((s,i)=>label(s,x,y+i*(size+6),size,fill,weight)).join('');
function ticks(model:DiagramModel):Date[]{
 const f=frame(model),spec=model.gantt!.tickInterval;
 if(!spec)return timeTicks(new Date(f.min),new Date(f.max),8);
 const match=/([0-9]+)(\w+)/.exec(spec)!,count=+match[1],unit=match[2].replace(/s$/,'');
 const weeks:Record<string,CountableTimeInterval>={monday:timeMonday,tuesday:timeTuesday,wednesday:timeWednesday,thursday:timeThursday,friday:timeFriday,saturday:timeSaturday,sunday:timeSunday};
 const units:Record<string,CountableTimeInterval>={millisecond:timeMillisecond,second:timeSecond,minute:timeMinute,hour:timeHour,day:timeDay,week:weeks[model.gantt!.weekday]??timeWeek,month:timeMonth,year:timeYear};
 const interval=units[unit].every(count);if(!interval)return [];
 // Bound work even when millisecond ticks are requested across years.
 const result:Date[]=[];let d=interval.ceil(new Date(f.min));for(let i=0;i<1000&&+d<=f.max;i++){result.push(d);const next=interval.offset(d,1);if(+next<=+d)break;d=next;}
 return result.length===1000?timeTicks(new Date(f.min),new Date(f.max),8):result;
}
export function renderGantt(model:DiagramModel):DiagramRenderResult{
 const started=performance.now(),layout=ganttLayout(model),f=frame(model),scale=axisScale(model),theme=model.gantt!.theme;
 const bottom=layout.height-80,axisY=f.top+26;
 const fmt=timeFormat(model.gantt!.axisFormat||(f.span<DAY*2?'%m/%d %H:%M':f.span>DAY*365?'%Y/%m':'%m/%d'));
 let body=lines(model.title||'Gantt chart',32,44,layout.width-64,26,'#25384b',700);
 body+=label('タスク / 期間',32,axisY,13,'#586c80',600);
 for(const c of tableColumns(model)){const h=wrapText(c.label,c.width-24,13).length;body+=lines(c.label,c.x+12,axisY-(h-1)*19,c.width-24,13,'#586c80',600)+`<path d="M ${c.x} ${f.top+34} V ${bottom}" stroke="#edf1f5"/>`;}
 const shade=model.gantt!.excluded.map(([a,b])=>`<rect x="${scale(a)}" y="${f.top+40}" width="${scale(b)-scale(a)}" height="${bottom-f.top-40}" fill="#64748b" opacity=".07"/>`).join('');body+=shade;
 let previous=-Infinity;
 for(const tick of ticks(model)){const px=scale(+tick),value=fmt(tick),width=Math.max(70,value.length*8);if(px-previous<width+14)continue;previous=px;body+=`<path d="M ${px} ${f.top+34} V ${bottom}" stroke="${escapeXml(theme.gridColor)}"/>`+label(value,px-width/2,axisY,13,'#586c80');}
 for(const g of layout.groups)body+=`<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="5" fill="#edf3f7"/>`+lines(g.group.label,36,g.y+25,g.width-24,16,'#334e65',600);
 for(const e of layout.edges){const p=e.points,tip=p[p.length-1],prev=p[p.length-2],sign=tip.y>prev.y?1:-1;body+=`<path class="archmap-edge archmap-dependency" data-from="${escapeXml(e.edge.from)}" data-to="${escapeXml(e.edge.to)}" d="${p.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')}" fill="none" stroke="#60758a" stroke-width="1.5" stroke-linejoin="round"${e.edge.label==='until'?' stroke-dasharray="4 3"':''}/><path d="M ${tip.x-4} ${tip.y-sign*5} L ${tip.x} ${tip.y} L ${tip.x+4} ${tip.y-sign*5}" fill="none" stroke="#60758a" stroke-width="1.5"/>`;}
 const date=timeFormat(datePattern(model));
 for(const n of layout.nodes){const t=n.node.gantt!,key=t.critical?'crit':t.done?'doneTask':t.active?'activeTask':'task',fill=(n.node.paint?.fill&&safePaint(n.node.paint.fill,true)?n.node.paint.fill:theme[key+'BkgColor']),stroke=theme[key+'BorderColor'];
  body+=`<g class="archmap-node archmap-gantt-task" data-node="${escapeXml(n.node.id)}"><title>${escapeXml(n.node.label)}: ${date(new Date(t.start))} – ${date(new Date(t.end))}</title>`;
  const texts=wrapText(n.node.label,290,16);body+=lines(n.node.label,36,n.y+18,290,16,theme.taskTextColor,600)+label(`${date(new Date(t.start))} → ${date(new Date(t.end))}`,36,n.y+18+texts.length*22,12,'#586c80');
  for(const c of tableColumns(model))body+=`<g class="archmap-gantt-cell" data-column="${escapeXml(c.key)}">${lines(cellText(model,n.node,c.key),c.x+12,n.y+18,c.width-24,14)}</g>`;
  if(t.vertical)body+=`<path d="M ${scale(t.start)} ${f.top+40} V ${bottom}" stroke="${escapeXml(fill)}" stroke-width="2" stroke-dasharray="5 4"/>`;
  else if(t.milestone)body+=`<path class="archmap-gantt-milestone" d="M ${n.x+9} ${n.y+5} l 9 9 -9 9 -9 -9 Z" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}"/>`;
  else body+=`<rect class="archmap-gantt-bar" x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${Math.min(5,n.width/2)}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}"/>`;
  const status=statusText(n.node);
  if(status&&!model.gantt!.columns?.some(c=>c.key==='status'))body+=label(status,36,n.y+18+texts.length*22+17,11,'#586c80');
  if(t.active&&!t.done)body+=`<path d="M ${n.x} ${n.y+n.height+4} h ${n.width}" stroke="${escapeXml(stroke)}" stroke-width="2"/>`;
  body+='</g>';
 }
 const today=Date.now();if(model.gantt!.todayMarker!=='off'&&today>=f.min&&today<=f.max)body+=`<path class="archmap-gantt-today" d="M ${scale(today)} ${f.top+38} V ${bottom}" stroke="${escapeXml(theme.todayLineColor)}" stroke-width="2" stroke-dasharray="5 4"/>`;
 const legend=[['task','予定'],['activeTask','進行中'],['doneTask','完了 ✓'],['crit','重要']];
 legend.forEach(([k,s],i)=>{body+=`<rect x="${36+i*140}" y="${layout.height-43}" width="16" height="12" rx="3" fill="${escapeXml(theme[k+'BkgColor'])}"/>`+label(s,60+i*140,layout.height-32,13,'#586c80');});
 body+=label('実線: after / 順次実行　破線: until　◆: マイルストーン',640,layout.height-32,13,'#586c80');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${escapeXml(model.title||'Gantt chart')}"><title>${escapeXml(model.title||'Gantt chart')}</title><rect width="100%" height="100%" fill="#fff"/><g font-family="${escapeXml(FONT)}">${body}</g></svg>`;
 return {svg,model,layout,durationMs:Math.round((performance.now()-started)*100)/100};
}
