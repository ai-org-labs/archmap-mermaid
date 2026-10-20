import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {segmentIntersectsBox} from '../src/focused/layout.js';
const source=(name:string)=>readFileSync(`docs/diagrams/group-grid/${name}.mmd`,'utf8');
const overlap=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
describe('subgraph grid',()=>{
 it.each(['environment-matrix','horizontal-span','vertical-span'])('packs %s without overlap and retains connections',async name=>{
  const model=await parseDiagram(source(name));expect(model.diagnostics).toEqual([]);
  const {layout:l,svg}=renderDiagram(model);expect(svg).not.toMatch(/NaN|Infinity/);
  expect(l.edges).toHaveLength(model.edges.length);
  for(let i=0;i<l.groups.length;i++)for(let j=i+1;j<l.groups.length;j++)expect(overlap(l.groups[i],l.groups[j])).toBe(false);
  for(const n of l.nodes){const g=l.groups.find(g=>g.group.id===n.node.group)!;expect(n.x).toBeGreaterThanOrEqual(g.x);expect(n.y).toBeGreaterThan(g.y);expect(n.x+n.width).toBeLessThanOrEqual(g.x+g.width);expect(n.y+n.height).toBeLessThanOrEqual(g.y+g.height);}
  for(const e of l.edges)for(let i=1;i<e.points.length;i++)for(const n of l.nodes){if(n.node.id===e.edge.from||n.node.id===e.edge.to)continue;expect(segmentIntersectsBox(e.points[i-1],e.points[i],n,-1)).toBe(false);}
  const g=(id:string)=>l.groups.find(g=>g.group.id===id)!;
  if(name==='horizontal-span'){expect(g('A').y).toBe(g('B').y);expect(g('C').x).toBe(g('A').x);expect(g('C').x+g('C').width).toBe(g('B').x+g('B').width);expect(g('C').y).toBeGreaterThan(g('A').y+g('A').height);}
  if(name==='vertical-span'){expect(g('A').x).toBe(g('B').x);expect(g('C').y).toBe(g('A').y);expect(g('C').y+g('C').height).toBe(g('B').y+g('B').height);}
  if(name==='environment-matrix')for(let row=1;row<=4;row++){expect(g(`s${row}_prod`).y).toBe(g(`s${row}_stage`).y);expect(g(`s${row}_stage`).y).toBe(g(`s${row}_dev`).y);expect(g(`s${row}_prod`).x).toBe(g('s1_prod').x);}
 });
 it('keeps nested boundaries, empty and collapsed groups renderable',async()=>{
  for(const extra of ['', 'A@{ view: collapsed }']) {
   const m=await parseDiagram('%% archmap: {"grid":{"columns":2,"items":[{"id":"A"},{"id":"B"},{"id":"C","colSpan":2}]}}\nflowchart TB\nsubgraph A[Outer]\nsubgraph I[Inner]\na[API] --> db[(DB)]\nend\nend\nsubgraph B[Empty]\nend\nsubgraph C[Other]\nc[Client]\nend\nC --> A\n'+extra);
   expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
   const {layout:l,svg}=renderDiagram(m);expect(svg).not.toMatch(/NaN|Infinity/);expect(l.edges).toHaveLength(extra?1:m.edges.length);
   const outer=l.groups.filter(g=>!g.group.parent);
   for(let i=0;i<outer.length;i++)for(let j=i+1;j<outer.length;j++)expect(overlap(outer[i],outer[j])).toBe(false);
   for(const g of l.groups.filter(g=>g.group.parent)){const parent=l.groups.find(p=>p.group.id===g.group.parent)!;expect(g.x).toBeGreaterThanOrEqual(parent.x);expect(g.y).toBeGreaterThan(parent.y);expect(g.x+g.width).toBeLessThanOrEqual(parent.x+parent.width);expect(g.y+g.height).toBeLessThanOrEqual(parent.y+parent.height);}
  }
 });
 it.each([{columns:0,items:[]},{columns:2,items:[{id:'A',colSpan:3}]},{columns:2,items:[{id:'A'},{id:'A'}]},{columns:2,items:[{id:'missing'}]},{columns:2,items:[{id:'A',rowSpan:0}]}])('rejects invalid grid %j',async grid=>{
  const m=await parseDiagram(`%% archmap: ${JSON.stringify({grid})}\nflowchart TB\nsubgraph A\na[A]\nend`);expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
 });
});
