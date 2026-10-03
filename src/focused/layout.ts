import {flowShapePort} from './flow-shapes.js';
import {imageSize} from './images.js';
import { groupAncestors, orderedGroups } from './groups.js';
import type { DiagramBox, DiagramLayoutOptions, DiagramLayout, DiagramLayoutEdge, DiagramLayoutNode, DiagramModel, DiagramNode, DiagramPoint, DiagramScreenContent } from "./types.js";

export const FONT = 'Inter, "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const TITLE_SIZE = 15;
export const BODY_SIZE = 12;
export const LABEL_SIZE = 12;
/** Deliberately conservative metrics; no browser, font download, or canvas is needed. */
export function textWidth(text: string, size = TITLE_SIZE): number {
  return Array.from(text).reduce((width, char) => width + size * (/\s/u.test(char) ? .36 : /[\u0000-\u00ff]/u.test(char) ? /[MW@#%&]/.test(char) ? .91 : /[ilI.,:;'!|]/.test(char) ? .34 : .64 : 1.06), 0);
}
export function wrapText(text: string, width: number, size = TITLE_SIZE): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const token of paragraph.match(/[A-Za-z0-9_./:-]+|\s+|[^A-Za-z0-9_./:\-\s]/gu) ?? []) {
      if (textWidth(line + token, size) <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      if (textWidth(token, size) <= width) { line = token.trimStart(); continue; }
      for (const char of Array.from(token)) {
        if (line && textWidth(line + char, size) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line || !lines.length) lines.push(line.trimEnd());
  }
  return lines;
}
export function nodeText(node: DiagramNode, kind: DiagramModel['kind'], width: number) {
  const centered = !!node.flowShape && !['rect','rounded','cyl','lin-cyl','fr-rect'].includes(node.flowShape) || node.shape === 'decision' || node.shape === 'start' || node.shape === 'end';
  const inset = node.shape === 'decision' || node.flowShape && !['rect','rounded','stadium','cyl','lin-cyl'].includes(node.flowShape) ? width * .25 : kind === 'sequence' ? 12 : 22;
  const content = width - inset * 2 - (!centered && (node.icon || node.participantType && node.participantType!=='participant') ? kind === 'sequence' ? 28 : 44 : 0);
  return { title: wrapText(node.label, content), description: node.description ? wrapText(node.description, content, BODY_SIZE) : [], inset, centered, header: kind === 'screens' ? 27 : 0 };
}
export function iconNodeText(node: DiagramNode) {
  return { title: wrapText(node.label, 140, TITLE_SIZE), description: node.description ? wrapText(node.description, 140, BODY_SIZE) : [] };
}
export function junctionText(node: DiagramNode) {
  const title = wrapText(node.label, 120, 12);
  const description = node.description ? wrapText(node.description, 120, 11) : [];
  return { title, description, width: Math.max(...title.map(line => textWidth(line, 12)), ...description.map(line => textWidth(line, 11))), height: title.length * 17 + (description.length ? 6 + description.length * 16 : 0) };
}
function iconNodeSize(node: DiagramNode) {
  const text = iconNodeText(node);
  return { width: 160, height: 62 + text.title.length * 21 + (text.description.length ? 6 + text.description.length * 17 : 0) + 6 };
}
function screenContent(node: DiagramNode, model: DiagramModel): DiagramScreenContent {
  const width = node.image?Math.max(280,imageSize(node).width+40):node.shape === 'modal' ? 240 : 280;
  const title = wrapText(node.label, width - (node.icon ? 76 : 40));
  const description = node.description ? wrapText(node.description, width - 40, BODY_SIZE) : [];
  const incoming = model.edges.filter(edge => edge.to === node.id && !edge.bidirectional).length;
  let headerHeight = Math.max(27 + 18 + Math.max(24, title.length * 21) + (description.length ? 8 + description.length * 17 : 0) + 16, 51 + Math.max(0, incoming - 1) * 14);
  const image=node.image?{x:(width-imageSize(node).width)/2,y:node.image.position==='t'?headerHeight:43,...imageSize(node)}:undefined;
  const titleY=node.image&&node.image.position==='b'?61+image!.height+16:61;
  if(image)headerHeight+=image.height+16;
  let top = headerHeight + 26;
  const items: Array<{ edge?: DiagramModel['edges'][number]; label: string; line: number; kind?: string; detail?: string }> = model.edges.filter(edge => !edge.actionLine && !model.nodes.find(n=>n.id===edge.to)?.noteTarget && (edge.from === node.id || edge.bidirectional && edge.to === node.id)).map(edge => {
    const destination = model.nodes.find(n => n.id === (edge.from === node.id ? edge.to : edge.from));
    return { edge, label: edge.label || (destination ? `${destination.label}へ` : '画面へ移動'), line: edge.line, ...(destination?.shape === 'modal' ? { kind: 'modal', detail: 'モーダルを開く' } : {}) };
  });
  for (const action of model.screenActions ?? []) if (action.node === node.id) {
    const target = model.nodes.find(n => n.id === action.to);
    const kind = action.to ? target?.shape === 'modal' ? 'modal' : 'navigate' : action.state ? 'state' : action.close ? 'close' : 'local';
    const detail = action.state ? `状態 → ${action.state}` : action.close ? 'モーダルを閉じる' : action.to ? kind === 'modal' ? 'モーダルを開く' : '画面へ移動' : `画面内操作${action.effect ? ` · ${action.effect}` : ''}`;
    items.push({ edge: model.edges.find(edge => edge.actionLine === action.line), label: action.label, line: action.line, kind, detail: `${action.when ? `${action.when}のとき · ` : ''}${detail}` });
  }
  const actions = (model.screenActions?.length ? items.sort((a,b)=>a.line-b.line) : items).map(item => {
    const lines = wrapText(item.label, width - 48, 13), detail = item.detail ? wrapText(item.detail, width - 48, 10) : undefined;
    const height = Math.max(42, lines.length * 18 + (detail ? 6 + detail.length * 14 : 0) + 20);
    const action = { ...item, detail, lines, top, height }; top += height;
    return action;
  });
  return { title, description, image, titleY, headerHeight, actions, height: actions.length ? top + 10 : headerHeight + 46 };
}
export function entityContent(node: DiagramNode) {
  const width=340, title=wrapText(node.label,width-32,15), header=24+title.length*21;
  const rows=(node.attributes??[]).map(a=>({a,names:wrapText(a.name,146,12),types:wrapText(a.type,94,11),comments:a.comment?wrapText(a.comment,width-32,11):[]}));
  const heights=rows.map(r=>Math.max(r.names.length*17,r.types.length*17,17)+14+(r.comments.length?r.comments.length*15+4:0));
  return {width,title,header,rows,heights,height:header+(rows.length?heights.reduce((a,b)=>a+b,0):38)};
}
function sizeNode(node: DiagramNode, kind: DiagramModel['kind']): { width: number; height: number } {
  if(node.image) {const im=imageSize(node),width=Math.max(180,im.width+40);return {width,height:im.height+48+wrapText(node.label,width-40).length*21+(node.description?wrapText(node.description,width-40,BODY_SIZE).length*17+8:0)};}
  if(node.attributes) {const e=entityContent(node);return {width:e.width,height:e.height};}
  const width = kind === 'sequence' ? 180 : node.shape === 'decision' ? 280 : 240;
  const text = nodeText(node, kind, width);
  const contentHeight = text.title.length * 21 + (text.description.length ? 9 + text.description.length * 17 : 0) + (kind==='sequence'?(node.links??[]).reduce((h,l)=>h+wrapText(l.label,width-24,12).length*17+8,0):0);
  const height = Math.max(kind === 'sequence' ? 44 : kind === 'screens' ? 114 : 88, contentHeight + (kind === 'sequence' ? 20 : 36) + text.header);
  if(node.flowShape && ['circle','dbl-circ','fr-circ','sm-circ','f-circ','cross-circ'].includes(node.flowShape))return {width,height:Math.max(width,height)};
  return { width, height: node.shape === 'decision' ? Math.max(140, height * 1.55) : height };
}
export function boxesOverlap(a: DiagramBox, b: DiagramBox, padding = 0): boolean {
  return a.x < b.x + b.width + padding && a.x + a.width + padding > b.x && a.y < b.y + b.height + padding && a.y + a.height + padding > b.y;
}
export function segmentIntersectsBox(a: DiagramPoint, b: DiagramPoint, box: DiagramBox, padding = 0): boolean {
  const left = box.x - padding, right = box.x + box.width + padding, top = box.y - padding, bottom = box.y + box.height + padding;
  if (a.x === b.x) return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  if (a.y === b.y) return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  return false;
}
function tidy(points: DiagramPoint[]): DiagramPoint[] {
  const result: DiagramPoint[] = [];
  for (const point of points) {
    if (result.length && result[result.length - 1]!.x === point.x && result[result.length - 1]!.y === point.y) continue;
    while (result.length >= 2) {
      const a = result[result.length - 2]!, b = result[result.length - 1]!;
      if ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y)) result.pop(); else break;
    }
    result.push(point);
  }
  return result;
}
function length(points: DiagramPoint[]): number {
  return points.slice(1).reduce((sum, point, i) => sum + Math.abs(point.x - points[i]!.x) + Math.abs(point.y - points[i]!.y), 0);
}
function ranks(model: DiagramModel): Map<string, number> {
  // Stable strongly connected components keep cycles bounded and preserve DAG depth.
  const adjacency = new Map(model.nodes.map(n => [n.id, [] as string[]]));
  for (const edge of model.edges) if (edge.from !== edge.to && adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from)!.push(edge.to);
  let clock = 0; const index = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], active = new Set<string>(), components: string[][] = [];
  function visit(id: string) {
    index.set(id, clock); low.set(id, clock++); stack.push(id); active.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!index.has(next)) { visit(next); low.set(id, Math.min(low.get(id)!, low.get(next)!)); }
      else if (active.has(next)) low.set(id, Math.min(low.get(id)!, index.get(next)!));
    }
    if (low.get(id) === index.get(id)) {
      const members: string[] = []; let next: string;
      do { next = stack.pop()!; active.delete(next); members.push(next); } while (next !== id);
      components.push(members);
    }
  }
  model.nodes.forEach(n => { if (!index.has(n.id)) visit(n.id); });
  const componentOf = new Map<string, number>(); components.forEach((c, i) => c.forEach(id => componentOf.set(id, i)));
  const depth = new Map<number, number>();
  function getDepth(c: number): number {
    if (depth.has(c)) return depth.get(c)!;
    let value = 0;
    for (const edge of model.edges) if (componentOf.get(edge.to) === c && componentOf.get(edge.from) !== c && componentOf.has(edge.from)) value = Math.max(value, getDepth(componentOf.get(edge.from)!) + 1);
    depth.set(c, value); return value;
  }
  return new Map(model.nodes.map(n => [n.id, getDepth(componentOf.get(n.id)!)]));
}
type Cell = { col: number; row: number };
type Side = 'left' | 'right' | 'top' | 'bottom';
function usesDirectedGroups(model: DiagramModel): boolean {
  return !['sequence','layers','usecase'].includes(model.kind) && model.groups.some(g=>g.direction) && !model.nodes.some(n=>n.at);
}
/** Lay out nested containers as units; a child's direction never rotates its parent. */
function directedGroupCells(model: DiagramModel): Map<string,Cell> {
  type Block = {id:string; width:number; height:number; cells:Map<string,Cell>};
  function build(parent:string|undefined,inherited:DiagramModel['direction']):Block {
    const group=model.groups.find(g=>g.id===parent),dir=group?.direction??inherited;
    const blocks:Block[]=[...model.nodes.filter(n=>n.group===parent).map(n=>({id:n.id,width:1,height:1,cells:new Map([[n.id,{col:0,row:0}]])})),...model.groups.filter(g=>g.parent===parent).map(g=>build(g.id,dir))];
    if(!blocks.length)return {id:parent??'',width:1,height:1,cells:new Map()};
    const owner=new Map<string,string>();
    for(const b of blocks){owner.set(b.id,b.id);for(const id of b.cells.keys())owner.set(id,b.id);for(const g of model.groups)if(groupAncestors(model,g.id).includes(b.id))owner.set(g.id,b.id);}
    const local={...model,nodes:blocks.map(b=>({id:b.id,label:'',shape:'card' as const,color:'blue' as const,line:0})),edges:model.edges.flatMap(e=>{const from=owner.get(e.from),to=owner.get(e.to);return from&&to&&from!==to?[{...e,from,to}]:[];})};
    const rank=ranks(local),horizontal=dir==='LR'||dir==='RL',reverse=dir==='RL'||dir==='BT';
    const positions=new Map<string,Cell>(),breadths=new Map<number,number>();let along=0,acrossMax=0;
    for(const level of [...new Set(rank.values())].sort((a,b)=>a-b)) {
      const lane=blocks.filter(b=>rank.get(b.id)===level);let across=0;
      for(const b of lane){positions.set(b.id,horizontal?{col:along,row:across}:{col:across,row:along});across+=(horizontal?b.height:b.width)+1;}
      breadths.set(level,across-1);acrossMax=Math.max(acrossMax,across-1);along+=Math.max(...lane.map(b=>horizontal?b.width:b.height))+1;
    }
    const width=horizontal?along-1:acrossMax,height=horizontal?acrossMax:along-1,cells=new Map<string,Cell>();
    for(const b of blocks) {
      const p=positions.get(b.id)!;
      p[horizontal?'row':'col']+=Math.floor((acrossMax-breadths.get(rank.get(b.id)!)!)/2);
      if(reverse){if(horizontal)p.col=width-p.col-b.width;else p.row=height-p.row-b.height;}
      for(const [id,c] of b.cells)cells.set(id,{col:p.col+c.col,row:p.row+c.row});
    }
    return {id:parent??'',width:width+2,height:height+2,cells:new Map([...cells].map(([id,c])=>[id,{col:c.col+1,row:c.row+1}]))};
  }
  return build(undefined,model.direction).cells;
}

function placeCells(model: DiagramModel): Map<string, Cell> {
  const cells = new Map<string, Cell>(), occupied = new Set<string>();
  const reserve = (node: DiagramNode, col: number, row: number) => {
    while (occupied.has(`${col},${row}`)) row++;
    occupied.add(`${col},${row}`); cells.set(node.id, { col, row });
  };
  const rankedModel={...model,edges:model.edges.filter(e=>!model.nodes.find(n=>n.id===e.to)?.noteTarget)};
  const depth = ranks(model.kind==='usecase'?{...model,edges:model.edges.map(e=>e.relationship==='extend'?{...e,from:e.to,to:e.from}:e)}:rankedModel);
  if (model.kind === 'layers') {
    const ungroupedRanks = [...new Set(model.nodes.filter(n => !n.group).map(n => depth.get(n.id) ?? 0))].sort((a, b) => a - b);
    const layerKeys = [...orderedGroups(model).filter(g => model.nodes.some(n => n.group === g.id)).map(g => g.id), ...ungroupedRanks.map(rank => `rank:${rank}`)];
    for (const node of model.nodes) {
      const row = layerKeys.indexOf(node.group ?? `rank:${depth.get(node.id) ?? 0}`);
      let col = 0; while (occupied.has(`${col},${row}`)) col++;
      reserve(node, col, row);
    }
    return cells;
  }
  // Manual coordinates reserve their cells first. Automatic nodes never cover them.
  for (const node of model.nodes) if (node.at) reserve(node, node.at[0] - 1, node.at[1] - 1);
  if(model.kind==='usecase') {
    let band=0;
    for(const group of [...orderedGroups(model).map(g=>g.id),'']) {
      const counts=new Map<number,number>();
      for(const n of model.nodes.filter(n=>(n.role!=='actor'||!!n.group)&&(n.group??'')===group)) if(!cells.has(n.id)) {
        const shift=model.nodes.some(n=>n.group===group&&n.role==='actor')?1:0;
        const rank=n.role==='actor'?1:Math.max(1,(depth.get(n.id)??1))+shift,index=band+(counts.get(rank)??0);
        counts.set(rank,(counts.get(rank)??0)+1);
        reserve(n,(model.direction==='LR'||model.direction==='RL')?rank:index,(model.direction==='LR'||model.direction==='RL')?index:rank);
      }
      band+=Math.max(0,...counts.values());
    }
    for(const n of model.nodes.filter(n=>n.role==='actor'&&!n.group)) if(!cells.has(n.id)) {
      const neighbors=model.edges.filter(e=>e.from===n.id||e.to===n.id).map(e=>cells.get(e.from===n.id?e.to:e.from)).filter((c):c is Cell=>!!c);
      const index=neighbors.length?Math.min(...neighbors.map(c=>(model.direction==='LR'||model.direction==='RL')?c.row:c.col)):0;
      // Reserve in the transverse direction so actors never drift into a system.
      let slot=index;
      while(occupied.has((model.direction==='LR'||model.direction==='RL')?`0,${slot}`:`${slot},0`))slot++;
      reserve(n,(model.direction==='LR'||model.direction==='RL')?0:slot,(model.direction==='LR'||model.direction==='RL')?slot:0);
    }
    // Manual coordinates preserve relative placement within a boundary. If
    // boundaries overlap, move the whole later boundary rather than nest it.
    const packed: Array<{left:number;right:number;top:number;bottom:number}> = [];
    for(const group of orderedGroups(model)) {
      const members=model.nodes.filter(n=>n.group===group.id);
      if(!members.length)continue;
      const bound=()=>({left:Math.min(...members.map(n=>cells.get(n.id)!.col)),right:Math.max(...members.map(n=>cells.get(n.id)!.col)),top:Math.min(...members.map(n=>cells.get(n.id)!.row)),bottom:Math.max(...members.map(n=>cells.get(n.id)!.row))});
      const others=[...packed,...model.nodes.filter(n=>!n.group).map(n=>{const c=cells.get(n.id)!;return {left:c.col,right:c.col,top:c.row,bottom:c.row};})];
      let box=bound();
      for(let tries=0;tries<=others.length;tries++) {
        const hits=others.filter(b=>box.left<=b.right&&box.right>=b.left&&box.top<=b.bottom&&box.bottom>=b.top);
        if(!hits.length)break;
        const shift=(model.direction==='LR'||model.direction==='RL')?Math.max(...hits.map(b=>b.bottom))+1-box.top:Math.max(...hits.map(b=>b.right))+1-box.left;
        for(const n of members) {const c=cells.get(n.id)!;if((model.direction==='LR'||model.direction==='RL'))c.row+=shift;else c.col+=shift;}
        box=bound();
      }
      packed.push(box);
    }
    return cells;
  }
  if(usesDirectedGroups(model)) {for(const [id,c] of directedGroupCells(model))cells.set(id,c);} else {
  let band = 0;
  const buckets = [...orderedGroups(model).map(g => g.id), ''];
  for (const group of buckets) {
    const members = model.nodes.filter(n => (n.group ?? '') === group && !cells.has(n.id));
    if (!members.length) continue;
    const counts = new Map<number, number>();
    for (const node of members) {
      const rank = depth.get(node.id) ?? 0, offset = counts.get(rank) ?? 0; counts.set(rank, offset + 1);
      const col = (model.direction === 'LR' || model.direction === 'RL') ? rank : offset;
      const row = (model.direction === 'LR' || model.direction === 'RL') ? band + offset : band + rank;
      reserve(node, col, row);
    }
    band = Math.max(band, ...members.map(n => cells.get(n.id)!.row + 1));
  }
  }
  // Orthogonal regions share the same start rank; they execute concurrently.
  for(const parent of model.groups) {
    const regions=model.groups.filter(g=>g.parent===parent.id&&g.concurrent);
    if(regions.length<2 || model.nodes.some(n=>n.at&&groupAncestors(model,n.group).includes(parent.id)))continue;
    const horizontal=model.direction==='LR'||model.direction==='RL';
    const along=horizontal?'col':'row',across=horizontal?'row':'col';
    const members=regions.map(g=>model.nodes.filter(n=>groupAncestors(model,n.group).includes(g.id)).map(n=>cells.get(n.id)!));
    const start=Math.min(...members.flat().map(c=>c[along]));let band=Math.min(...members.flat().map(c=>c[across]));
    for(const list of members) {
      if(!list.length)continue;
      const shiftAlong=start-Math.min(...list.map(c=>c[along])),shiftAcross=band-Math.min(...list.map(c=>c[across]));
      for(const c of list){c[along]+=shiftAlong;c[across]+=shiftAcross;}
      band=Math.max(...list.map(c=>c[across]))+1;
    }
  }
  if(model.nodes.some(n=>n.noteTarget)) {
    for(const c of cells.values())c.col=c.col*3+1;
    for(const n of model.nodes.filter(n=>n.noteTarget&&!n.at)) {
      const members=model.nodes.filter(target=>target.id===n.noteTarget||groupAncestors(model,target.group).includes(n.noteTarget!)).map(target=>cells.get(target.id)!);
      if(!members.length)continue;
      const col=n.notePosition==='left'?Math.min(...members.map(c=>c.col))-1:Math.max(...members.map(c=>c.col))+1;let row=Math.min(...members.map(c=>c.row));
      while([...cells.entries()].some(([id,c])=>id!==n.id&&c.col===col&&c.row===row))row++;
      cells.set(n.id,{col,row});
    }
  }
  // Compact empty grid tracks while retaining the ordering of authored coordinates.
  const columns = [...new Set([...cells.values()].map(c => c.col))].sort((a, b) => a - b);
  const rows = [...new Set([...cells.values()].map(c => c.row))].sort((a, b) => a - b);
  for (const cell of cells.values()) { cell.col = columns.indexOf(cell.col); cell.row = rows.indexOf(cell.row); }
  return cells;
}
function port(node: DiagramLayoutNode, side: Side, offset: number): DiagramPoint {
  if (node.junction) {
    const bar = node.junction;
    return side === 'top' || side === 'bottom'
      ? { x: bar.x + bar.width / 2 + offset, y: bar.y + (side === 'bottom' ? bar.height : 0) }
      : { x: bar.x + (side === 'right' ? bar.width : 0), y: bar.y + bar.height / 2 + offset };
  }
  const x = node.x + node.width / 2, y = node.y + node.height / 2;
  if (node.iconMode) {
    if (side === 'left' || side === 'right') return { x: x + (side === 'left' ? -24 : 24), y: node.y + 24 + offset };
    return { x: x + offset, y: side === 'top' ? node.y : node.y + node.height };
  }
  if (node.screen && (side === 'left' || side === 'right')) return { x: side === 'left' ? node.x : node.x + node.width, y: node.y + 27 + (node.screen.headerHeight - 27) / 2 + offset };
  const shaped=node.node.flowShape?flowShapePort(node.node.flowShape,node.width,node.height,side,offset):undefined;
  if(shaped)return {x:node.x+shaped.x,y:node.y+shaped.y};
  if (side === 'left' || side === 'right') {
    const inset = node.node.shape === 'decision' ? Math.abs(offset) * node.width / node.height : 0;
    return { x: side === 'left' ? node.x + inset : node.x + node.width - inset, y: y + offset };
  }
  const inset = node.node.shape === 'decision' ? Math.abs(offset) * node.height / node.width : 0;
  return { x: x + offset, y: side === 'top' ? node.y + inset : node.y + node.height - inset };
}
function sidePair(a: DiagramLayoutNode, b: DiagramLayoutNode, direction: DiagramModel['direction']): [Side, Side] {
  if (a === b) return ['right', 'bottom'];
  const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2;
  if (a.node.shape === 'decision') {
    if ((direction === 'TD' || direction === 'BT') && Math.abs(dx) > 1) return [dx < 0 ? 'left' : 'right', dy >= 0 ? 'top' : 'bottom'];
    if ((direction === 'LR' || direction === 'RL') && Math.abs(dy) > 1) return [dy < 0 ? 'top' : 'bottom', dx >= 0 ? 'left' : 'right'];
  }
  if (b.node.shape === 'end') {
    if ((direction === 'TD' || direction === 'BT') && Math.abs(dx) > 1) return [dy >= 0 ? 'bottom' : 'top', dx > 0 ? 'left' : 'right'];
    if ((direction === 'LR' || direction === 'RL') && Math.abs(dy) > 1) return [dx >= 0 ? 'right' : 'left', dy > 0 ? 'top' : 'bottom'];
  }
  if ((direction === 'LR' && dx < -1 || direction === 'RL' && dx > 1)) return Math.abs(dy) < 1 ? ['top', 'top'] : dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  if ((direction === 'TD' && dy < -1 || direction === 'BT' && dy > 1)) return Math.abs(dx) < 1 ? ['right', 'right'] : dx > 0 ? ['right', 'left'] : ['left', 'right'];
  if ((direction === 'LR' || direction === 'RL') && Math.abs(dx) > 1 || Math.abs(dy) < 1) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}
function labelSize(label: string): { width: number; height: number } {
  const lines = wrapText(label, 166, LABEL_SIZE);
  return { width: Math.max(34, ...lines.map(line => textWidth(line, LABEL_SIZE) + 18)), height: lines.length * 16 + 10 };
}
function labelPositions(points: DiagramPoint[], size: { width: number; height: number }): DiagramBox[] {
  const boxes: DiagramBox[] = [];
  const segments = points.slice(1).map((b, i) => ({ a: points[i]!, b, len: Math.abs(b.x - points[i]!.x) + Math.abs(b.y - points[i]!.y) })).sort((a, b) => b.len - a.len);
  for (const { a, b, len } of segments) {
    const horizontal = a.y === b.y, needed = horizontal ? size.width + 28 : size.height + 22;
    if (len < needed) continue;
    for (const fraction of [.5, .3, .7]) boxes.push({ x: a.x + (b.x - a.x) * fraction - size.width / 2, y: a.y + (b.y - a.y) * fraction - size.height / 2, ...size });
  }
  return boxes;
}
function sequenceLayout(model: DiagramModel): DiagramLayout {
  const margin = 56;
  const sizes = model.nodes.map(node => sizeNode(node, 'sequence'));
  const nodeHeight = Math.max(44, ...sizes.map(s => s.height));
  const messageWidth = Math.max(170, ...model.edges.map(e => e.label ? labelSize(e.label).width : 0));
  const pitch = Math.max(328, messageWidth + 110);
  const titleSpace = (model.title ? wrapText(model.title, Math.max(280, model.nodes.length * pitch - 72), 19).length * 26 + 28 : 16) + (model.groups.length?40:0);
  const nodes = model.nodes.map((node, i) => ({ node, x: margin + i * pitch, y: margin + titleSpace, width: sizes[i]!.width, height: nodeHeight }));
  const byId = new Map(nodes.map(n => [n.node.id, n]));
  let y = margin + titleSpace + nodeHeight + 56;
  const edges: DiagramLayoutEdge[] = [];
  const activations: NonNullable<DiagramLayout['activations']> = [];
  const open = new Map<string, typeof activations>();
  const fragments: NonNullable<DiagramLayout['fragments']> = [];
  const fragmentStack: typeof fragments = [];
  const notes: NonNullable<DiagramLayout['notes']> = [];
  const destructions: NonNullable<DiagramLayout['destructions']> = [];
  const controls = [...model.activationEvents ?? [], ...model.fragmentEvents ?? [], ...model.noteEvents ?? []].sort((a, b) => a.line - b.line);
  const frameRight = Math.max(margin + 200, ...nodes.map(n => n.x + n.width)) + 24;
  function applyActivations(afterEdge: number, at: number): number {
    let cursor = at;
    for (const event of controls) {
      if (event.afterEdge !== afterEdge) continue;
      if ('placement' in event) {
        const a=byId.get(event.from),b=byId.get(event.to);if(!a||!b)continue;
        const ax=a.x+a.width/2,bx=b.x+b.width/2;
        const width=event.placement==='over'?Math.max(240,Math.abs(bx-ax)+160):240;
        const height=wrapText(event.label,width-32,12).length*17+28;
        const x=event.placement==='left'?ax-width-24:event.placement==='right'?ax+24:Math.min(ax,bx)- (ax===bx?width/2:80);
        notes.push({x,y:cursor+24,width,height,label:event.label,line:event.line});cursor+=height+48;
        continue;
      }
      if (!('node' in event)) {
        if (event.action === 'alt' || event.action === 'opt' || event.action === 'loop' || event.action === 'par' || event.action === 'critical' || event.action === 'break' || event.action === 'rect') {
          const depth = fragmentStack.length, x = 24 + depth * 16, width = frameRight - depth * 16 - x;
          const headerHeight = Math.max(34, wrapText(event.label, width - 84, 12).length * 17 + 16);
          const frame = { fill:event.fill, kind: event.action, label: event.action==='rect'?'':event.label, line: event.line, depth, x, y: cursor + 24, width, height: 0, headerHeight, branches: [] as Array<{ label: string; y: number; height: number }> };
          fragments.push(frame); fragmentStack.push(frame); cursor = frame.y + headerHeight + 12;
        } else {
          const frame = fragmentStack[fragmentStack.length - 1];
          if (frame && (event.action === 'else' || event.action === 'and' || event.action === 'option')) {
            const height = Math.max(32, wrapText(event.label, frame.width - 32, 12).length * 17 + 16);
            const branch = { label: event.label, y: cursor + 24, height };
            frame.branches.push(branch); cursor = branch.y + height + 12;
          } else if (frame) { frame.height = Math.max(frame.headerHeight + 48, cursor + 24 - frame.y); cursor = frame.y + frame.height + 12; fragmentStack.pop(); }
        }
        continue;
      }
      const node = byId.get(event.node); if (!node) continue;
      const stack = open.get(event.node) ?? [];
      if (event.action === 'activate') {
        const bar = { node: event.node, depth: stack.length, line: event.line, x: node.x + node.width / 2 - 6 + stack.length * 8, y: cursor, width: 12, height: 16 };
        activations.push(bar); stack.push(bar);
      } else {
        const bar = stack.pop();
        if (bar) { bar.height = Math.max(16, cursor + 12 - bar.y); cursor = bar.y + bar.height + 8; }
      }
      open.set(event.node, stack);
    }
    return cursor;
  }
  y = Math.max(y, applyActivations(0, y - 24) + 24);
  for (const [index, edge] of model.edges.entries()) {
    const a = byId.get(edge.from), b = byId.get(edge.to); if (!a || !b) continue;
    const size = edge.label ? labelSize(edge.label) : undefined;
    y += size ? Math.max(0, size.height - 26) : 0;
    if(b.node.createdAt===edge.line-1)b.y=y-b.height/2;
    for(const n of nodes) if(n.node.destroyedAt===edge.line-1)destructions.push({node:n.node.id,x:n.x+n.width/2,y});
    const ax = a.x + a.width / 2, bx = b.node.createdAt===edge.line-1 ? (a.x<b.x?b.x:b.x+b.width) : b.x + b.width / 2;
    const points = a === b ? [{ x: ax, y }, { x: ax + Math.max(86, (size?.width ?? 0) + 24), y }, { x: ax + Math.max(86, (size?.width ?? 0) + 24), y: y + 32 }, { x: ax, y: y + 32 }] : [{ x: ax, y }, { x: bx, y }];
    edges.push({ edge, points, ...(size ? { labelBox: { x: bx >= ax ? ax + 12 : ax - 12 - size.width, y: y - size.height - 8, ...size } } : {}) });
    const cursor = applyActivations(index + 1, a === b ? y + 32 : y);
    y = Math.max(y + (a === b ? 110 : 78), cursor + 56);
  }
  // Keep manually constructed models renderable; parsed sources require closed intervals.
  for (const stack of open.values()) for (const bar of stack) bar.height = Math.max(16, y - 28 - bar.y);
  const activeAt = (node: string, at: number) => activations.filter(bar => bar.node === node && at >= bar.y && at <= bar.y + bar.height).sort((a, b) => b.depth - a.depth)[0];
  for (const item of edges) {
    const first = item.points[0]!, last = item.points[item.points.length - 1]!;
    const self = item.edge.from === item.edge.to, right = self || last.x >= first.x;
    const source = activeAt(item.edge.from, first.y), target = activeAt(item.edge.to, last.y);
    if (source && item.edge.central!=='source' && item.edge.central!=='both') first.x = source.x + (right ? source.width : 0);
    if (target && item.edge.central!=='target' && item.edge.central!=='both') last.x = target.x + (self || !right ? target.width : 0);
    if (item.labelBox) item.labelBox.x = right ? first.x + 12 : first.x - 12 - item.labelBox.width;
  }
  const rightmost = Math.max(margin + 200, ...nodes.map(n => n.x + n.width), ...edges.flatMap(e => e.points.map(p => p.x)), ...edges.map(e => e.labelBox ? e.labelBox.x + e.labelBox.width : 0));
  for (const frame of fragments) frame.width = Math.max(frame.width, rightmost + 24 - frame.depth * 16 - frame.x);
  const height=Math.ceil(Math.max(y+28,margin+titleSpace+nodeHeight+160));
  const groups=model.groups.map(group=>{
    const members=nodes.filter(n=>n.node.group===group.id),x=Math.min(...members.map(n=>n.x))-20;
    return {group,x,y:margin+titleSpace-36,width:Math.max(...members.map(n=>n.x+n.width))+20-x,height:height-32-(margin+titleSpace-36)};
  }).filter(g=>Number.isFinite(g.x));
  // Notes left of the first lifeline reserve actual canvas space, not clipped negative coordinates.
  const shift=Math.max(0,24-Math.min(24,...notes.map(n=>n.x),...groups.map(g=>g.x)));
  for(const box of [...nodes,...groups,...notes,...fragments,...activations])box.x+=shift;
  for(const e of edges){for(const p of e.points)p.x+=shift;if(e.labelBox)e.labelBox.x+=shift;}
  for(const d of destructions)d.x+=shift;
  return {width:Math.ceil(Math.max(rightmost+shift+margin,...notes.map(n=>n.x+n.width+24),...groups.map(g=>g.x+g.width+24),...fragments.map(f=>f.x+f.width+24))),height,nodes,groups,edges,notes,destructions,...(activations.length?{activations}:{}),...(fragments.length?{fragments}:{})};
}

/** Quantities which must not get worse to obtain a nicer aspect ratio. */
function layoutDefects(layout: DiagramLayout, model: DiagramModel): number[] {
  let collisions = 0, shared = 0, crossings = 0, labelHits = 0;
  for (const [i,n] of layout.nodes.entries()) for (const other of layout.nodes.slice(i + 1)) if (boxesOverlap(n, other)) collisions++;
  for (const [i,g] of layout.groups.entries()) {
    for (const n of layout.nodes) if (!groupAncestors(model,n.node.group).includes(g.group.id) && boxesOverlap(g,n)) collisions++;
    for (const other of layout.groups.slice(i + 1)) if (!groupAncestors(model,other.group.id).includes(g.group.id) && !groupAncestors(model,g.group.id).includes(other.group.id) && boxesOverlap(g,other)) collisions++;
  }
  const captions: DiagramBox[] = [...layout.nodes.flatMap(n => n.junctionLabel ? [n.junctionLabel] : []), ...layout.groups.map(g => ({x:g.x+16,y:g.y+9,width:Math.min(g.width-32,textWidth(g.group.label,12)),height:wrapText(g.group.label,g.width-34,12).length*17+5}))];
  for (const [i, edge] of layout.edges.entries()) {
    for (let k = 1; k < edge.points.length; k++) {
      const a = edge.points[k - 1]!, b = edge.points[k]!;
      for (const n of layout.nodes) {
        if (n.node.id === edge.edge.from && k === 1 || n.node.id === edge.edge.to && k === edge.points.length - 1) continue;
        if (segmentIntersectsBox(a, b, n.junction ?? n, -1)) collisions++;
      }
      for (const caption of captions) if (segmentIntersectsBox(a,b,caption,2)) labelHits++;
      for (const other of layout.edges) if (other !== edge && other.labelBox && segmentIntersectsBox(a, b, other.labelBox, 2)) labelHits++;
      for (const other of layout.edges.slice(i + 1)) for (let j = 1; j < other.points.length; j++) {
        const c = other.points[j - 1]!, d = other.points[j]!;
        if (a.x === b.x && c.x === d.x && a.x === c.x && Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)) > Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) || a.y === b.y && c.y === d.y && a.y === c.y && Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) > Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))) shared++;
        if (a.x === b.x && c.y === d.y && a.x > Math.min(c.x,d.x) && a.x < Math.max(c.x,d.x) && c.y > Math.min(a.y,b.y) && c.y < Math.max(a.y,b.y) || a.y === b.y && c.x === d.x && c.x > Math.min(a.x,b.x) && c.x < Math.max(a.x,b.x) && a.y > Math.min(c.y,d.y) && a.y < Math.max(c.y,d.y)) crossings++;
      }
    }
    if (edge.labelBox) {
      for (const n of layout.nodes) if (boxesOverlap(edge.labelBox, n.junction ?? n)) labelHits++;
      for (const other of layout.edges.slice(i + 1)) if (other.labelBox && boxesOverlap(edge.labelBox, other.labelBox)) labelHits++;
    }
  }
  return [collisions, shared, crossings, labelHits];
}

export function computeDiagramLayout(model: DiagramModel, options: DiagramLayoutOptions = {}): DiagramLayout {
  const target = options.targetAspectRatio ?? 1.4;
  if (!Number.isFinite(target) || target < 0.25 || target > 4) throw new RangeError('targetAspectRatio must be between 0.25 and 4');
  const baseline = layoutWithSpacing(model);
  // Respect authored coordinates and diagram-specific chronology/layer geometry.
  // Limit the extra routing work: at most two candidates for modest graphs.
  if (options.balance === 'off' || ['sequence','layers'].includes(model.kind) || model.nodes.some(n => n.at) || model.nodes.length > 80 || model.edges.length > 60) return baseline;
  const ratio = baseline.width / baseline.height;
  const deviation = (l: DiagramLayout) => Math.abs(Math.log(l.width / l.height / target));
  if (deviation(baseline) < Math.log(1.8)) return baseline;
  const defects = layoutDefects(baseline, model);
  const distance = (l: DiagramLayout) => l.edges.reduce((sum,e) => sum + length(e.points), 0);
  const bends = (l: DiagramLayout) => l.edges.reduce((sum,e) => sum + Math.max(0, e.points.length - 2), 0);
  const baseDistance = distance(baseline), baseBends = bends(baseline);
  const score = (l: DiagramLayout) => deviation(l) + 0.15 * Math.log(l.width * l.height / (baseline.width * baseline.height));
  let best = baseline;
  for (const factor of [0.8, 0.55]) {
    const candidate = layoutWithSpacing(model, ratio > target ? {x: factor, y: 1} : {x: 1, y: factor});
    // Do not buy a squarer canvas with overlaps, detours or extra bends.
    if (distance(candidate) > baseDistance * 1.05 || bends(candidate) > baseBends || score(candidate) >= score(best) - 0.01) continue;
    if (layoutDefects(candidate, model).some((value,i) => value > defects[i]!)) continue;
    best = candidate;
  }
  return best;
}

function layoutWithSpacing(model: DiagramModel, spacing = {x: 1, y: 1}): DiagramLayout {
  if (model.kind === 'sequence') return sequenceLayout(model);
  if(model.groups.some(g=>g.collapsed)) {
    const owner=(id:string)=>{
      const node=model.nodes.find(n=>n.id===id);
      return groupAncestors(model,node?node.group:id).filter(g=>model.groups.find(group=>group.id===g)?.collapsed).pop();
    };
    const projected={...model,nodes:model.nodes.filter(n=>!owner(n.id)),groups:model.groups.filter(g=>!owner(g.id)||owner(g.id)===g.id).map(g=>({...g,collapsed:false})),edges:model.edges.flatMap(e=>{
      const from=owner(e.from)||e.from,to=owner(e.to)||e.to;
      return from===to&&(from!==e.from||to!==e.to)?[]:[{...e,from,to}];
    })};
    const layout=layoutWithSpacing(projected, spacing);
    return {...layout,groups:layout.groups.map(g=>({...g,group:model.groups.find(original=>original.id===g.group.id)!}))};
  }
  // Give empty leaf groups a layout-only footprint; never add fake model nodes.
  const empty=model.groups.filter(g=>!model.nodes.some(n=>n.group===g.id)&&!model.groups.some(child=>child.parent===g.id));
  if(empty.length) {
    const ids=new Set([...model.nodes.map(n=>n.id),...model.groups.map(g=>g.id)]), ghosts=new Set<string>();
    const placeholders=empty.map((g,i)=>{let id=`__empty_group_${i}`;while(ids.has(id))id+='_';ids.add(id);ghosts.add(id);return {id,label:'',group:g.id,shape:'card' as const,color:g.color,line:0};});
    const layout=layoutWithSpacing({...model,nodes:[...model.nodes,...placeholders]}, spacing);
    return {...layout,nodes:layout.nodes.filter(n=>!ghosts.has(n.node.id))};
  }

  const iconStyle = model.style === 'icons' && (model.kind === 'system' || model.kind === 'layers');
  const usesIcon = (node: DiagramNode) => !node.image && iconStyle && (node.shape === 'card' || node.shape === 'database');
  const cells = placeCells(model), sizes = model.nodes.map(node => {
    if (node.shape === 'fork' || node.shape === 'join') {
      const text = junctionText(node);
      return (model.direction === 'TD' || model.direction === 'BT') ? { width: Math.max(240, 120 + 2 * (24 + text.width)), height: Math.max(12, text.height) } : { width: 240, height: 120 + 2 * (24 + text.height) };
    }
    if (model.kind === 'screens' && (node.shape === 'card' || node.shape === 'modal')) {
      const screen = screenContent(node, model);
      return { width: node.image?Math.max(280,imageSize(node).width+40):node.shape === 'modal' ? 240 : 280, height: screen.height, screen };
    }
    return usesIcon(node) ? iconNodeSize(node) : sizeNode(node, model.kind);
  });
  if(!usesDirectedGroups(model)&&(model.direction==='RL'||model.direction==='BT')) {
    const axis=model.direction==='RL'?'col':'row',max=Math.max(0,...[...cells.values()].map(c=>c[axis]));
    const occupied=new Set(model.nodes.filter(n=>n.at).map(n=>{const c=cells.get(n.id)!;return `${c.col},${c.row}`;}));
    for(const n of model.nodes)if(!n.at){const c=cells.get(n.id)!;c[axis]=max-c[axis];while(occupied.has(`${c.col},${c.row}`))c[axis==='col'?'row':'col']++;occupied.add(`${c.col},${c.row}`);}
  }
  const maxW = Math.max(iconStyle ? 160 : 240, ...sizes.map(s => s.width)), maxH = Math.max(88, ...sizes.map(s => s.height));
  const maxLabel = Math.max(0, ...model.edges.map(e => e.label ? labelSize(e.label).width : 0));
  const degree = new Map<string, number>(); model.edges.forEach(e => { degree.set(e.from, (degree.get(e.from) ?? 0) + 1); degree.set(e.to, (degree.get(e.to) ?? 0) + 1); });
  const maxDegree = Math.max(0, ...degree.values());
  const nesting = Math.max(1, ...model.groups.map(group => groupAncestors(model, group.id).length));
  const screenGap = model.kind === 'screens' ? maxDegree * 16 + 64 : 0;
  const baseGapX = Math.max(screenGap, nesting > 1 ? nesting * 44 + 48 : 0, iconStyle ? Math.max(96, maxLabel + 32, Math.min(maxDegree, 16) * 8 + 48) : Math.max(170, maxLabel + 48, Math.min(maxDegree, 16) * 12 + 72));
  const groupHeader = Math.max(46, ...model.groups.map(g => wrapText(g.label, Math.min(250, ...sizes.map(size => size.width + 10)), 12).length * 17 + 24));
  // Activity flows often have many short rows. Reserve space for labels and
  // branching without imposing the system diagram's 132px corridor on each step.
  const baseGapY = Math.max(screenGap, model.kind === 'activity'
    ? Math.max(64, model.groups.length ? groupHeader + 32 : 0, Math.min(maxDegree, 16) * 8 + 32)
    : iconStyle ? Math.max(88, groupHeader + 40, Math.min(maxDegree, 16) * 8 + 48) : Math.max(132, groupHeader + 64, Math.min(maxDegree, 16) * 10 + 68));
  // Never shrink nodes, labels or heading clearance. Only routing corridors vary.
  const gapX = Math.max(baseGapX * spacing.x, Math.min(baseGapX, Math.max(64, screenGap, maxLabel + 24, nesting > 1 ? nesting * 44 + 48 : 0)));
  const gapY = Math.max(baseGapY * spacing.y, Math.min(baseGapY, Math.max(48, screenGap, model.groups.length ? groupHeader + 32 : 0)));
  const marginX = Math.max(screenGap ? gapX / 2 + 32 : 0, 100, maxLabel / 2 + 36, nesting * 22 + 24);
  const columns = Math.max(1, ...[...cells.values()].map(c => c.col + 1)), rows = Math.max(1, ...[...cells.values()].map(c => c.row + 1));
  const pitchX = maxW + gapX;
  const titleHeight = model.title ? wrapText(model.title, marginX * 2 + columns * maxW + (columns - 1) * gapX - 72, 19).length * 26 + 22 : 0;
  const marginY = titleHeight + Math.max(groupHeader * nesting + 48, screenGap ? gapY / 2 + 32 : 0);
  const xGutters = Array.from({ length: columns + 1 }, (_, i) => marginX - gapX / 2 + i * pitchX);
  // Nested headings need room only where that group actually starts. Reserving
  // the full nesting depth on every row makes long component columns sparse.
  const groupStart = new Map(model.groups.map(g => [g.id, Math.min(...model.nodes.filter(n => groupAncestors(model,n.group).includes(g.id)).map(n => cells.get(n.id)!.row))]));
  const rowGaps = Array.from({length:rows},(_,row) => Math.max(gapY, ...model.groups.map(g => groupAncestors(model,g.id).filter(id => groupStart.get(id) === row).length * groupHeader + 24)));
  const rowY = [marginY];
  for (let row=1; row<rows; row++) rowY.push(rowY[row-1]! + maxH + rowGaps[row]!);
  const yGutters = [...rowY.map((y,row) => y - rowGaps[row]! / 2), rowY[rows-1]! + maxH + gapY/2];
  const nodes: DiagramLayoutNode[] = model.nodes.map((node, i) => ({ node, x: marginX + cells.get(node.id)!.col * pitchX + (maxW - sizes[i]!.width) / 2, y: rowY[cells.get(node.id)!.row]! + (usesIcon(node) || model.kind === 'screens' && (node.shape === 'card' || node.shape === 'modal') ? 0 : (maxH - sizes[i]!.height) / 2), ...sizes[i]!, ...(usesIcon(node) ? { iconMode: true } : {}) }));
  const nodeById = new Map(nodes.map(n => [n.node.id, n]));
  for (const node of nodes) if (node.node.shape === 'fork' || node.node.shape === 'join') {
    const cx = node.x + node.width / 2, cy = node.y + node.height / 2, text = junctionText(node.node);
    node.junction = (model.direction === 'TD' || model.direction === 'BT') ? { x: cx - 60, y: cy - 5, width: 120, height: 10 } : { x: cx - 5, y: cy - 60, width: 10, height: 120 };
    node.junctionLabel = (model.direction === 'TD' || model.direction === 'BT') ? { x: cx + 84, y: cy - text.height / 2, width: text.width, height: text.height } : { x: cx - text.width / 2, y: cy + 84, width: text.width, height: text.height };
  }
  const junctionLabels = nodes.flatMap(node => node.junctionLabel ? [node.junctionLabel] : []);
  const groups: DiagramLayout['groups'] = [];
  const groupLabels: DiagramBox[] = [];
  const groupOrder = orderedGroups(model);
  const groupBoxes = new Map<string, DiagramLayout['groups'][number]>();
  // Build from children upward, then paint parents before their children.
  for (const group of [...groupOrder].reverse()) {
    const members: DiagramBox[] = [...nodes.filter(n => n.node.group === group.id), ...groupOrder.filter(child => child.parent === group.id).flatMap(child => groupBoxes.has(child.id) ? [groupBoxes.get(child.id)!] : [])];
    if (!members.length) continue;
    const x = Math.min(...members.map(n => n.x)) - 22;
    const width = Math.max(...members.map(n => n.x + n.width)) - x + 22;
    const header = Math.max(46, wrapText(group.label, width - 34, 12).length * 17 + 24);
    const y = Math.min(...members.map(n => n.y)) - header;
    const height = Math.max(...members.map(n => n.y + n.height)) - y + 22;
    groupBoxes.set(group.id, { group, x, y, width, height });
    groupLabels.push({ x: x + 16, y: y + 9, width: Math.min(width - 32, textWidth(group.label, 12)), height: wrapText(group.label, width - 34, 12).length * 17 + 5 });
  }
  for (const group of groupOrder) if (groupBoxes.has(group.id)) groups.push(groupBoxes.get(group.id)!);
  // Group endpoints retain their identity and attach to the container boundary.
  // These routing proxies are never rendered as ordinary nodes.
  for (const {group, ...box} of groups) nodeById.set(group.id, {
    ...box, node: {id:group.id,label:group.label,group:group.parent,shape:'card',color:group.color,line:group.line},
  });
  const containsEndpoint = (container: DiagramLayoutNode, other: DiagramLayoutNode) =>
    groupBoxes.has(container.node.id) && container !== other && groupAncestors(model, other.node.group).includes(container.node.id);
  const opposite = (side: Side): Side => ({left:'right',right:'left',top:'bottom',bottom:'top'} as const)[side];
  // Assign ports from geometry, not edge declaration order. Aligned connections
  // keep the center; branches occupy the side nearest their destination.
  const pairCounts = new Map<string, number>();
  const compareKey = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  const connectionKey = (edge: DiagramModel['edges'][number]) => `${edge.from}:${edge.to}:${edge.style === 'solid' ? 0 : 1}:${edge.label}`;
  const specs = [...model.edges].sort((a, b) => compareKey(connectionKey(a), connectionKey(b))).flatMap(edge => {
    const a = nodeById.get(edge.from), b = nodeById.get(edge.to); if (!a || !b) return [];
    const localDirection=groupAncestors(model,a.node.group).filter(id=>groupAncestors(model,b.node.group).includes(id)).map(id=>model.groups.find(g=>g.id===id)?.direction).find(Boolean)??model.direction;
    let [sa, sb] = sidePair(a, b, model.kind === 'layers' ? 'TD' : localDirection);
    if (containsEndpoint(a,b)) sa = sb = 'right';
    if (containsEndpoint(b,a)) sa = sb = 'right';
    const pair = `${edge.from}:${edge.to}`, repetition = pairCounts.get(pair) ?? 0; pairCounts.set(pair, repetition + 1);
    if (repetition && a !== b) { if (a.y === b.y) sa = sb = repetition % 2 ? 'bottom' : 'top'; else if (a.x === b.x) sa = sb = repetition % 2 ? 'right' : 'left'; }
    // Synchronization bars connect through their broad faces, leaving their captions clear.
    if (a.junction) sa = (model.direction === 'TD' || model.direction === 'BT') ? (b.y >= a.y ? 'bottom' : 'top') : (b.x >= a.x ? 'right' : 'left');
    if (b.junction) sb = (model.direction === 'TD' || model.direction === 'BT') ? (a.y <= b.y ? 'top' : 'bottom') : (a.x <= b.x ? 'left' : 'right');
    // An action owns its source port. Incoming transitions attach to the screen header.
    const screenDeltaX = b.x + b.width / 2 - a.x - a.width / 2;
    if (a.screen) sa = screenDeltaX < -1 ? 'left' : 'right';
    if (b.screen) sb = a === b ? 'top' : edge.bidirectional ? screenDeltaX > 1 ? 'left' : 'right' : Math.abs(screenDeltaX) < 1 ? 'top' : screenDeltaX > 0 ? 'left' : 'right';
    // A return to the preceding screen goes around the row, away from forward arrivals.
    if (a.screen && b.screen && a.y === b.y && b.x < a.x && !edge.bidirectional && model.edges.some(other => other.from === edge.to && other.to === edge.from)) {
      sa = 'right'; sb = 'top';
    }
    return [{ edge, a, b, sa, sb, start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }];
  });
  type PortRequest = { spec: typeof specs[number]; endpoint: 'start' | 'end'; node: DiagramLayoutNode; side: Side; delta: number };
  const portGroups = new Map<string, PortRequest[]>();
  const edgeKey = (spec: typeof specs[number]) => connectionKey(spec.edge);
  for (const spec of specs) for (const endpoint of ['start', 'end'] as const) {
    const node = endpoint === 'start' ? spec.a : spec.b, other = endpoint === 'start' ? spec.b : spec.a;
    const side = endpoint === 'start' ? spec.sa : spec.sb, horizontal = side === 'top' || side === 'bottom';
    const action = endpoint === 'start' || spec.edge.bidirectional && spec.a !== spec.b ? node.screen?.actions.find(item => item.edge === spec.edge) : undefined;
    if (action) {
      spec[endpoint] = { x: side === 'left' ? node.x : node.x + node.width, y: node.y + action.top + action.height / 2 };
      continue;
    }
    const delta = horizontal ? other.x + other.width / 2 - node.x - node.width / 2 : other.y + other.height / 2 - node.y - node.height / 2;
    const key = `${node.node.id}:${side}`;
    const requests = portGroups.get(key) ?? [];
    requests.push({ spec, endpoint, node, side, delta }); portGroups.set(key, requests);
  }
  const screenArrivalTracks = new Map<string, number[]>();
  for (const requests of portGroups.values()) {
    requests.sort((a, b) => a.delta - b.delta || compareKey(edgeKey(a.spec), edgeKey(b.spec)));
    const { node, side } = requests[0]!;
    const limit = node.junction ? Math.max(0, (side === 'left' || side === 'right' ? node.junction.height : node.junction.width) / 2 - 8) : node.screen && (side === 'left' || side === 'right') ? Math.max(0, (node.screen.headerHeight - 27) / 2 - 12) : node.iconMode ? 16 : (side === 'left' || side === 'right' ? node.height : node.width) / 2 - 24;
    const pivot = requests.reduce((best, item, i) => Math.abs(item.delta) < Math.abs(requests[best]!.delta) ? i : best, 0);
    // Leave room for a neighboring straight edge's label as well as its stroke.
    // A 16–24px fan can otherwise pass through a label centered on that edge.
    const preferredSpacing = Math.max(24, ...requests.map(({ spec }) => {
      if (!spec.edge.label) return 24;
      const label = labelSize(spec.edge.label);
      return Math.ceil(((side === 'left' || side === 'right' ? label.height : label.width) / 2 + 12) / 8) * 8;
    }));
    // Synchronization bars also preserve an aligned branch at their center.
    // Space the remaining ports within the bar rather than shifting that branch.
    const anchor = Math.abs(requests[pivot]!.delta) < 1 ? pivot : (requests.length - 1) / 2;
    const spacing = node.junction
      ? limit / Math.max(1, anchor, requests.length - anchor - 1)
      : Math.min(preferredSpacing, limit / Math.max(1, pivot, requests.length - pivot - 1));
    requests.forEach((request, i) => {
      const point = port(node, side, (i - anchor) * spacing);
      if (node.screen && (side === 'left' || side === 'right')) {
        // Opposite faces share a corridor: reserve arrival heights across both cards.
        const cell = cells.get(node.node.id)!;
        const key = `${cell.row}:${cell.col + (side === 'right' ? 1 : 0)}`;
        const used = screenArrivalTracks.get(key) ?? [];
        const low = node.y + 39, high = node.y + node.screen.headerHeight - 12;
        const candidates = [point.y, ...Array.from({ length: Math.max(1, Math.floor(high - low) + 1) }, (_, j) => low + j)];
        candidates.sort((a, b) => Math.abs(a - point.y) - Math.abs(b - point.y) || a - b);
        const available = candidates.find(y => y >= low && y <= high && used.every(other => Math.abs(y - other) >= 14));
        if (available !== undefined) point.y = available;
        used.push(point.y); screenArrivalTracks.set(key, used);
      }
      request.spec[request.endpoint] = point;
    });
  }
  const aligned = (spec: typeof specs[number]) => spec.start.x === spec.end.x && spec.sa !== spec.sb || spec.start.y === spec.end.y && spec.sa !== spec.sb;
  const originalOrder = new Map(model.edges.map((edge, i) => [edge, i]));
  // Establish simple aligned routes first, then route branches around them.
  specs.sort((a, b) => Number(aligned(b)) - Number(aligned(a)) || length([a.start, a.end]) - length([b.start, b.end]) || compareKey(edgeKey(a), edgeKey(b)));
  let edges: DiagramLayoutEdge[] = [], usedLabels: DiagramBox[] = [];
  const extent = { width: marginX * 2 + columns * maxW + (columns - 1) * gapX, height: rowY[rows-1]! + maxH + 90 };
  const pathCost = (points: DiagramPoint[]) => {
    const distance = length(points);
    const direct = length([points[0]!, points[points.length - 1]!]);
    // A reduced crossing count must not buy a lap around the whole canvas.
    const excess = ['system','er','usecase'].includes(model.kind) ? Math.max(0, distance - direct - (gapX + gapY) / 2) : 0;
    return distance + Math.max(0, points.length - 2) * 60 + excess * 3;
  };
  const routeOne = (spec: typeof specs[number], edgeIndex: number) => {
    const { edge, a, b, start, end } = spec;
    const sa = containsEndpoint(a,b) ? opposite(spec.sa) : spec.sa;
    const sb = containsEndpoint(b,a) ? opposite(spec.sb) : spec.sb;
    const ca = cells.get(a.node.id)!, cb = cells.get(b.node.id)!;
    const markerClearance = edge.sourceMarker || edge.targetMarker ? 28 : 16;
    const laneSpacing = model.kind === 'screens' ? 16 : 8;
    const lane = edgeIndex === 0 ? 0 : (Math.ceil(edgeIndex / 2) % 4) * (edgeIndex % 2 ? laneSpacing : -laneSpacing);
    const escape = (point: DiagramPoint, side: Side, cell: Cell | undefined): DiagramPoint => !cell
      ? {x:point.x+(side==='left'?-16:side==='right'?16:0),y:point.y+(side==='top'?-16:side==='bottom'?16:0)} : side === 'left' || side === 'right'
      ? { x: xGutters[cell.col + (side === 'right' ? 1 : 0)]! + lane, y: point.y }
      : { x: point.x, y: yGutters[cell.row + (side === 'bottom' ? 1 : 0)]! + lane };
    const ea = escape(start, sa, ca), eb = escape(end, sb, cb), ah = sa === 'left' || sa === 'right', bh = sb === 'left' || sb === 'right';
    const candidates: DiagramPoint[][] = [
      [start, { x: end.x, y: start.y }, end],
      [start, { x: start.x, y: end.y }, end],
    ];
    // Two-bend paths can use the middle of the shared corridor directly;
    // routing via two separate escape tracks creates unnecessary tiny doglegs.
    if (ah && bh) {
      for (const x of [(start.x + end.x) / 2, ea.x, eb.x]) candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
    } else if (!ah && !bh) {
      for (const y of [(start.y + end.y) / 2, ea.y, eb.y]) candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
    }
    const outward = (origin: DiagramPoint, next: DiagramPoint, side: Side) => side === 'left' ? next.y === origin.y && next.x < origin.x : side === 'right' ? next.y === origin.y && next.x > origin.x : side === 'top' ? next.x === origin.x && next.y < origin.y : next.x === origin.x && next.y > origin.y;
    if (a !== b && (start.x === end.x && (sa === 'bottom' && sb === 'top' || sa === 'top' && sb === 'bottom') || start.y === end.y && (sa === 'right' && sb === 'left' || sa === 'left' && sb === 'right'))) candidates.push([start, end]);
    if (ah && bh) for (const y of yGutters) candidates.push([start, ea, { x: ea.x, y: y + lane }, { x: eb.x, y: y + lane }, eb, end]);
    else if (!ah && !bh) for (const x of xGutters) candidates.push([start, ea, { x: x + lane, y: ea.y }, { x: x + lane, y: eb.y }, eb, end]);
    else {
      candidates.push([start, ea, ah ? { x: ea.x, y: eb.y } : { x: eb.x, y: ea.y }, eb, end]);
      for (const x of xGutters) for (const y of yGutters) candidates.push(ah
        ? [start, ea, { x: ea.x, y: y + lane }, { x: x + lane, y: y + lane }, { x: x + lane, y: eb.y }, eb, end]
        : [start, ea, { x: x + lane, y: ea.y }, { x: x + lane, y: y + lane }, { x: eb.x, y: y + lane }, eb, end]);
    }
    {
      // Long branches must be able to turn before the middle of a shared gap.
      // Otherwise their fixed escape segment can overlap a neighboring arrival
      // and visually turn two unrelated flows into a single connection.
      const stub = (p: DiagramPoint, side: Side): DiagramPoint => ({
        x: p.x + (side === 'left' ? -markerClearance : side === 'right' ? markerClearance : 0),
        y: p.y + (side === 'top' ? -markerClearance : side === 'bottom' ? markerClearance : 0),
      });
      const first = stub(start, sa), last = stub(end, sb);
      const labelClearance = edge.label ? labelSize(edge.label).height / 2 + 18 : 24;
      const localY = ah && bh ? [Math.min(start.y, end.y) - labelClearance, Math.max(start.y, end.y) + labelClearance] : [];
      for (const y of [...localY, ...yGutters]) candidates.push([start, first, {x:first.x,y}, {x:last.x,y}, last, end]);
      for (const x of xGutters) candidates.push([start, first, {x,y:first.y}, {x,y:last.y}, last, end]);
    }
    {
      // Offer every available track in the gutters instead of cycling four lanes.
      const reach = Math.floor((Math.min(gapX, gapY) / 2 - 16) / 16);
      for (let track = -reach; track <= reach; track++) {
        const offset = track * 16;
        const exit = (point: DiagramPoint, side: Side, cell: Cell | undefined): DiagramPoint => !cell
      ? {x:point.x+(side==='left'?-16:side==='right'?16:0),y:point.y+(side==='top'?-16:side==='bottom'?16:0)} : side === 'left' || side === 'right'
          ? { x: Math.max(16, xGutters[cell.col + (side === 'right' ? 1 : 0)]! + offset), y: point.y }
          : { x: point.x, y: Math.max(titleHeight + 16, yGutters[cell.row + (side === 'bottom' ? 1 : 0)]! + offset) };
        const first = exit(start, sa, ca), last = exit(end, sb, cb);
        if (ah && bh) {
          for (const x of [first.x, last.x]) candidates.push([start, {x,y:start.y}, {x,y:end.y}, end]);
          for (const y of yGutters) {
            const trackY = Math.max(titleHeight + 16, y + offset);
            candidates.push([start, first, {x:first.x,y:trackY}, {x:last.x,y:trackY}, last, end]);
          }
        } else if (!ah && !bh) {
          for (const y of [first.y, last.y]) candidates.push([start, {x:start.x,y}, {x:end.x,y}, end]);
          for (const x of xGutters) {
            const trackX = Math.max(16, x + offset);
            candidates.push([start, first, {x:trackX,y:first.y}, {x:trackX,y:last.y}, last, end]);
          }
        } else candidates.push([start, first, ah ? {x:first.x,y:last.y} : {x:last.x,y:first.y}, last, end]);
      }
    }
    let best: { points: DiagramPoint[]; labelBox?: DiagramBox; score: number } | undefined;
    const size = edge.label && !a.screen && !(edge.bidirectional && b.screen) ? labelSize(edge.label) : undefined;
    for (const raw of candidates) {
      const points = tidy(raw);
      // Collision and label penalties are nonnegative. A candidate whose base
      // cost already loses cannot improve the result; skip its expensive scans.
      let score = pathCost(points);
      if (best && score >= best.score) continue;
      if (points.length < 2 || !outward(start, points[1]!, sa) || !outward(end, points[points.length - 2]!, sb)) continue;
      if(edge.sourceMarker&&length(points.slice(0,2))<28 || edge.targetMarker&&length(points.slice(-2))<28)continue;
      if (points.slice(1).some((p, i) => junctionLabels.some(box => segmentIntersectsBox(points[i]!, p, box, 8)))) continue;
      if (points.slice(1).some((p, i) => nodes.some(n => !(n === a && i === 0) && !(n === b && i === points.length - 2) && segmentIntersectsBox(points[i]!, p, n, -1)))) continue;
      for (let i = 1; i < points.length; i++) {
        for (const box of [...usedLabels, ...groupLabels]) if (segmentIntersectsBox(points[i - 1]!, points[i]!, box, 9)) score += 3000;
        for (const previous of edges) for (let j = 1; j < previous.points.length; j++) {
          const p = points[i - 1]!, q = points[i]!, r = previous.points[j - 1]!, s = previous.points[j]!;
          if (p.x === q.x && r.x === s.x && p.x === r.x && Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) > Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)) || p.y === q.y && r.y === s.y && p.y === r.y && Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) > Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x))) score += 1e7;
          if (p.x === q.x && r.y === s.y && p.x > Math.min(r.x, s.x) && p.x < Math.max(r.x, s.x) && r.y > Math.min(p.y, q.y) && r.y < Math.max(p.y, q.y) || p.y === q.y && r.x === s.x && r.x > Math.min(p.x, q.x) && r.x < Math.max(p.x, q.x) && p.y > Math.min(r.y, s.y) && p.y < Math.max(r.y, s.y)) score += ['system','er','usecase'].includes(model.kind) ? 1000 : 240;
        }
      }
      let labelBox: DiagramBox | undefined;
      if (size) {
        let labelScore = Infinity;
        for (const box of labelPositions(points, size)) {
          if (box.x < 8 || box.y < (titleHeight + 8) || nodes.some(n => boxesOverlap(box, n, 12)) || [...usedLabels, ...groupLabels].some(other => boxesOverlap(box, other, 8))) continue;
          let penalty = 0;
          for (const previous of edges) for (let j = 1; j < previous.points.length; j++) if (segmentIntersectsBox(previous.points[j - 1]!, previous.points[j]!, box, 4)) penalty += 1800;
          if (penalty < labelScore) { labelScore = penalty; labelBox = box; }
        }
        if (!labelBox) score += 1e7; else score += labelScore;
      }
      if (!best || score < best.score) best = { points, labelBox, score };
    }
    const chosen = best ?? { points: tidy([start, ea, { x: ea.x, y: eb.y }, eb, end]), score: 0 };
    // A crowded label gets a connected outer route, preserving its association.
    if (size && !chosen.labelBox) {
      const y = Math.max(extent.height + size.height, ...usedLabels.map(box => box.y + box.height + size.height + 18));
      const left = extent.width + 28, right = left + size.width + 44;
      const sourceGutter = ah ? (ca ? yGutters[ca.row + 1]! : a.y + a.height + 16) + lane : ea.y;
      const targetGutter = bh ? (cb ? yGutters[cb.row + 1]! : b.y + b.height + 16) + lane : eb.y;
      chosen.points = tidy([start, ea, { x: ea.x, y: sourceGutter }, { x: left, y: sourceGutter }, { x: left, y }, { x: right, y }, { x: right, y: targetGutter }, { x: eb.x, y: targetGutter }, eb, end]);
      chosen.labelBox = { x: left + 22, y: y - size.height / 2, ...size };
    }
    if (chosen.labelBox) usedLabels.push(chosen.labelBox);
    edges.push({ edge, points: chosen.points, ...(chosen.labelBox ? { labelBox: chosen.labelBox } : {}) });
  };
  const routeAll = (order: typeof specs) => {
    edges = []; usedLabels = [];
    order.forEach(routeOne);
  };
  routeAll(specs);
  // Greedy routing is order-sensitive. Compare a bounded set of whole-diagram
  // solutions, rather than fixing every earlier route as an immutable obstacle.
  const solutionCost = () => {
    let cost = 0;
    for (const [i, e] of edges.entries()) {
      cost += pathCost(e.points);
      for (let k = 1; k < e.points.length; k++) {
        const a = e.points[k - 1]!, b = e.points[k]!;
        for (const n of nodes) {
          if (n.node.id === e.edge.from && k === 1 || n.node.id === e.edge.to && k === e.points.length - 1) continue;
          if (segmentIntersectsBox(a,b,n,-1)) cost += 1e9;
        }
        for (const other of edges) if (other !== e && other.labelBox && segmentIntersectsBox(a, b, other.labelBox, 4)) cost += 10000;
        for (const other of edges.slice(i + 1)) {
          for (let j = 1; j < other.points.length; j++) {
            const c = other.points[j - 1]!, d = other.points[j]!;
            if (a.x === b.x && c.x === d.x && a.x === c.x && Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)) > Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) || a.y === b.y && c.y === d.y && a.y === c.y && Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x)) > Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))) cost += 1e7;
            if (a.x === b.x && c.y === d.y && a.x > Math.min(c.x,d.x) && a.x < Math.max(c.x,d.x) && c.y > Math.min(a.y,b.y) && c.y < Math.max(a.y,b.y) || a.y === b.y && c.x === d.x && c.x > Math.min(a.x,b.x) && c.x < Math.max(a.x,b.x) && a.y > Math.min(c.y,d.y) && a.y < Math.max(c.y,d.y)) cost += 1000;
          }
        }
      }
    }
    return cost;
  };
  if (['system','er','usecase'].includes(model.kind) && specs.length > 1 && specs.length <= 60) {
    let best = { edges, usedLabels, cost: solutionCost() };
    const orders = [
      [...specs].reverse(),
      [...specs].sort((a,b) => length([b.start,b.end]) - length([a.start,a.end]) || compareKey(edgeKey(a),edgeKey(b))),
      [...specs].sort((a,b) => (degree.get(b.a.node.id)! + degree.get(b.b.node.id)!) - (degree.get(a.a.node.id)! + degree.get(a.b.node.id)!) || compareKey(edgeKey(a),edgeKey(b))),
      [...specs].sort((a,b) => a.start.y - b.start.y || a.end.y - b.end.y || compareKey(edgeKey(a),edgeKey(b))),
    ];
    for (const order of orders) {
      routeAll(order);
      const cost = solutionCost();
      if (cost < best.cost) best = { edges, usedLabels, cost };
    }
    edges = best.edges; usedLabels = best.usedLabels;
    // Rip up one route at a time, retaining the other lines and their labels.
    // Accept only whole-diagram improvements; never trade a new overlap for length.
    for (let pass = 0; pass < 2; pass++) {
      let improved = false;
      for (const [i, spec] of specs.entries()) {
        const oldEdges = edges, oldLabels = usedLabels;
        edges = edges.filter(e => e.edge !== spec.edge);
        usedLabels = edges.flatMap(e => e.labelBox ? [e.labelBox] : []);
        const fixedEdges = edges, fixedLabels = usedLabels;
        const freePort = (node: DiagramLayoutNode, side: Side) => {
          const occupied = fixedEdges.flatMap(e => [
            ...(e.edge.from === node.node.id ? [e.points[0]!] : []),
            ...(e.edge.to === node.node.id ? [e.points[e.points.length - 1]!] : []),
          ]);
          const limit = node.iconMode ? 16 : (side === 'left' || side === 'right' ? node.height : node.width) / 2 - 24;
          for (const offset of [0, -16, 16, -32, 32, -48, 48]) {
            if (Math.abs(offset) > limit) continue;
            const p = port(node, side, offset);
            if (occupied.every(q => Math.abs(q.x-p.x)+Math.abs(q.y-p.y) >= 12)) return p;
          }
          return undefined;
        };
        const variants = [spec];
        if (!spec.a.junction && !spec.b.junction && spec.a !== spec.b) {
          const sides: Side[] = ['left','right','top','bottom'];
          for (const side of sides) {
            if (side !== spec.sa) {
              const start = freePort(spec.a, side);
              if (start) variants.push({...spec, sa:side, start});
            }
            if (side !== spec.sb) {
              const end = freePort(spec.b, side);
              if (end) variants.push({...spec, sb:side, end});
            }
          }
        }
        if (spec.a !== spec.b && !spec.a.junction && !spec.b.junction) {
          const dx = spec.b.x + spec.b.width / 2 - spec.a.x - spec.a.width / 2;
          const dy = spec.b.y + spec.b.height / 2 - spec.a.y - spec.a.height / 2;
          const pairs: [Side, Side][] = [dx >= 0 ? ['right','left'] : ['left','right'], dy >= 0 ? ['bottom','top'] : ['top','bottom'], ['right','right'], ['left','left'], ['top','top'], ['bottom','bottom']];
          for (const [sa,sb] of pairs) {
            const start = sa === spec.sa ? spec.start : freePort(spec.a,sa);
            const end = sb === spec.sb ? spec.end : freePort(spec.b,sb);
            if (start && end) variants.push({...spec,sa,sb,start,end});
          }
        }
        let local = {edges: oldEdges, usedLabels: oldLabels, cost: best.cost};
        for (const variant of variants) {
          edges = [...fixedEdges]; usedLabels = [...fixedLabels];
          routeOne(variant, i);
          const cost = solutionCost();
          if (cost < local.cost) local = {edges, usedLabels, cost};
        }
        edges = local.edges; usedLabels = local.usedLabels;
        if (local.cost < best.cost) { best = local; improved = true; }
      }
      if (!improved) break;
    }
  }
  const width = Math.ceil(Math.max(extent.width, ...groups.map(group => group.x + group.width + 24), ...edges.flatMap(e => e.points.map(p => p.x + 48)), ...usedLabels.map(b => b.x + b.width + 30)));
  const height = Math.ceil(Math.max(extent.height, ...groups.map(group => group.y + group.height + 24), ...edges.flatMap(e => e.points.map(p => p.y + 48)), ...usedLabels.map(b => b.y + b.height + 30)));
  edges.sort((a, b) => originalOrder.get(a.edge)! - originalOrder.get(b.edge)!);
  return { width, height, nodes, groups, edges };
}
