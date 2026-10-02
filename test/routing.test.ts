import {readFileSync} from 'node:fs';
import fan from './fixtures/fan-topology.json';
import nested from './fixtures/nested-topology.json';
import type {DiagramModel} from '../src/focused/types.js';
import {describe,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {computeDiagramLayout, segmentIntersectsBox, boxesOverlap} from '../src/focused/layout.js';
import type {DiagramLayout,DiagramPoint} from '../src/focused/types.js';
function shared(a:DiagramPoint,b:DiagramPoint,c:DiagramPoint,d:DiagramPoint) {
 for(const [axis,along] of [['x','y'],['y','x']] as const) if(Math.abs(a[axis]-b[axis])<.01&&Math.abs(c[axis]-d[axis])<.01&&Math.abs(a[axis]-c[axis])<.01)
  return Math.max(0,Math.min(Math.max(a[along],b[along]),Math.max(c[along],d[along]))-Math.max(Math.min(a[along],b[along]),Math.min(c[along],d[along])));
 return 0;
}
function assertClear(l:DiagramLayout){
 for(const [i,e] of l.edges.entries()) {
  for(let k=1;k<e.points.length;k++) {
   const a=e.points[k-1]!,b=e.points[k]!;
   expect(a.x===b.x||a.y===b.y).toBe(true);
   for(const n of l.nodes) {
    if(n.node.id===e.edge.from&&k===1||n.node.id===e.edge.to&&k===e.points.length-1)continue;
    expect(segmentIntersectsBox(a,b,n,-1),`${e.edge.from}->${e.edge.to} / ${n.node.id}`).toBe(false);
   }
   for(const other of l.edges.slice(i+1))for(let j=1;j<other.points.length;j++)expect(shared(a,b,other.points[j-1]!,other.points[j]!)).toBeLessThan(.1);
  }
  if(e.labelBox)for(const n of l.nodes)expect(boxesOverlap(e.labelBox,n)).toBe(false);
 }
}
describe('orthogonal corridor allocation',()=>{
 it.each([{fixture:fan,budget:20000},{fixture:nested,budget:27000}])('keeps dense authored layouts separated and local ($budget)',({fixture,budget})=>{
  const l=computeDiagramLayout(fixture as unknown as DiagramModel);assertClear(l);
  const total=l.edges.reduce((sum,e)=>sum+e.points.slice(1).reduce((s,p,i)=>s+Math.abs(p.x-e.points[i]!.x)+Math.abs(p.y-e.points[i]!.y),0),0);
  expect(total).toBeLessThan(budget);
  let crossings = 0;
  for (const [i,e] of l.edges.entries()) for(let k=1;k<e.points.length;k++) {
    const a=e.points[k-1]!,b=e.points[k]!;
    for(const other of l.edges.slice(i+1))for(let j=1;j<other.points.length;j++) {
      const c=other.points[j-1]!,d=other.points[j]!;
      if(a.x===b.x&&c.y===d.y&&a.x>Math.min(c.x,d.x)&&a.x<Math.max(c.x,d.x)&&c.y>Math.min(a.y,b.y)&&c.y<Math.max(a.y,b.y)||a.y===b.y&&c.x===d.x&&c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x)&&a.y>Math.min(c.y,d.y)&&a.y<Math.max(c.y,d.y))crossings++;
    }
  }
  expect(crossings).toBeLessThanOrEqual(fixture===fan?3:24);
  if(fixture===nested)expect(l.height).toBeLessThan(2450);
  const model=fixture as unknown as DiagramModel;
  const reversed=computeDiagramLayout({...model,edges:[...model.edges].reverse()});
  for(const e of l.edges)expect(reversed.edges.find(other=>other.edge===e.edge)).toEqual(e);
 });
 it('separates a fan with more branches than the old four repeating tracks',async()=>{
  const m=await parseDiagram(`%% archmap: {"nodes":{"a":{"at":[1,4]},"b":{"at":[2,1]},"c":{"at":[2,3]},"d":{"at":[2,5]},"e":{"at":[2,7]},"f":{"at":[3,2]},"g":{"at":[3,6]}}}
flowchart LR
 a[Coordinator] --> b[Branch B]
 a --> c[Branch C]
 a --> d[Branch D]
 a --> e[Branch E]
 a -->|Notify| f[Output F]
 a -->|Update| g[Output G]`);
  expect(m.diagnostics).toEqual([]);
  const l=computeDiagramLayout(m);assertClear(l);
  const reversed=computeDiagramLayout({...m,edges:[...m.edges].reverse()});
  for(const e of l.edges)expect(reversed.edges.find(x=>x.edge===e.edge)?.points).toEqual(e.points);
 });
 it('keeps labeled parallel connections inside a nearby corridor',async()=>{
  const m=await parseDiagram(`flowchart LR
 a[Output] -->|Render callback with timing| b[Mixer]
 a --> b
 a --> b`);
  expect(m.diagnostics).toEqual([]);
  const l=computeDiagramLayout(m);assertClear(l);
  for(const e of l.edges){
   const length=e.points.slice(1).reduce((s,p,i)=>s+Math.abs(p.x-e.points[i]!.x)+Math.abs(p.y-e.points[i]!.y),0);
   expect(length).toBeLessThan(1000);
  }
 });
 it('renders stateDiagram-v2 transitions with choice and start/end markers',async()=>{
  const m=await parseDiagram(`%% archmap: {"view":"activity"}
stateDiagram-v2
 [*] --> Idle
 Idle --> Active: start
 Active --> Idle: stop
 state check <<choice>>
 Active --> check
 check --> Idle: retry
 check --> [*]: finish`);
  expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
  const l=computeDiagramLayout(m);expect(l.edges).toHaveLength(6);
  expect(l.nodes.some(n=>n.node.shape==='decision')).toBe(true);
 });
});


function agentExample(name:string) {
 return readFileSync(`docs/diagrams/agent-examples/${name}.mmd`,'utf8');
}
function crossingCount(layout:DiagramLayout) {
 let count=0;
 for(const [i,e] of layout.edges.entries())for(let k=1;k<e.points.length;k++) {
  const a=e.points[k-1]!,b=e.points[k]!;
  for(const other of layout.edges.slice(i+1))for(let j=1;j<other.points.length;j++) {
   const c=other.points[j-1]!,d=other.points[j]!;
   if(a.x===b.x&&c.y===d.y&&a.x>Math.min(c.x,d.x)&&a.x<Math.max(c.x,d.x)&&c.y>Math.min(a.y,b.y)&&c.y<Math.max(a.y,b.y)||a.y===b.y&&c.x===d.x&&c.x>Math.min(a.x,b.x)&&c.x<Math.max(a.x,b.x)&&a.y>Math.min(c.y,d.y)&&a.y<Math.max(c.y,d.y))count++;
  }
 }
 return count;
}
it('optimizes a small system without crossings or declaration-order dependence',async()=>{
 const model=await parseDiagram(agentExample('01-pdf-system'));
 expect(model.diagnostics).toEqual([]);
 expect(model.edges).toHaveLength(7);
 const layout=computeDiagramLayout(model);assertClear(layout);
 expect(crossingCount(layout)).toBe(0);
 expect(layout.edges.reduce((sum,e)=>sum+Math.max(0,e.points.length-2),0)).toBeLessThanOrEqual(9);
 const reversed=computeDiagramLayout({...model,edges:[...model.edges].reverse()});
 for(const e of layout.edges)expect(reversed.edges.find(other=>other.edge===e.edge)?.points).toEqual(e.points);
});
it.each(['TB','BT','LR','RL'])('keeps compact activity corridors clear (%s)',async direction=>{
 const model=await parseDiagram(agentExample('02-pdf-activity').replace('direction TB',`direction ${direction}`));
 expect(model.diagnostics).toEqual([]);
 const layout=computeDiagramLayout(model);
 // A synchronization node reserves room for its caption; its solid obstacle is the bar.
 assertClear({...layout,nodes:layout.nodes.map(n=>n.junction?{...n,...n.junction}:n)});
 expect(crossingCount(layout)).toBe(0);
 if(direction==='TB'||direction==='BT')expect(layout.height).toBeLessThan(1900);
 for(const [from,to] of [['parallel','extract'],['extract','complete']])expect(layout.edges.find(e=>e.edge.from===from&&e.edge.to===to)!.points).toHaveLength(2);
});
it('leaves room for multiline activity conditions and composite headings',async()=>{
 const model=await parseDiagram(`%% archmap: {"view":"activity"}
stateDiagram-v2
 direction TB
 state Processing {
  [*] --> Check
  state Check <<choice>>
  Check --> Save: all required validation checks succeeded
  Check --> Reject: validation failed and user correction is required
  Save --> [*]
  Reject --> [*]
 }
 [*] --> Processing
 Processing --> [*]`);
 expect(model.diagnostics).toEqual([]);
 const layout=computeDiagramLayout(model);assertClear(layout);
 for(const e of layout.edges)if(e.labelBox)for(const other of layout.edges)if(other!==e)for(let i=1;i<other.points.length;i++)expect(segmentIntersectsBox(other.points[i-1]!,other.points[i]!,e.labelBox,0)).toBe(false);
});
