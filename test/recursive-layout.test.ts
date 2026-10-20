import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {boxesOverlap,segmentIntersectsBox,wrapText,textWidth} from '../src/focused/layout.js';
import {groupContains} from '../src/focused/groups.js';
import {OUTPUT_THEME} from '../src/focused/theme.js';
import type {DiagramBox} from '../src/focused/types.js';
const contains=(a:DiagramBox,b:DiagramBox)=>b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width+.001&&b.y+b.height<=a.y+a.height+.001;
it.each(['nested-three-children','branching-directions','nested-directions','nested-directions-grid'].flatMap(name=>['LR','RL','TB','BT'].map(direction=>({name,direction}))))('$name / $direction keeps descendants and routes clear',async({name,direction})=>{
 const m=await parseDiagram(readFileSync(`docs/diagrams/group-grid/${name}.mmd`,'utf8').replace('flowchart LR',`flowchart ${direction}`));
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const snapshot=JSON.stringify(m),r=renderDiagram(m),l=r.layout;expect(JSON.stringify(m)).toBe(snapshot);expect(r.svg).not.toMatch(/NaN|Infinity/);expect(l.edges).toHaveLength(m.edges.length);
 for(const [i,g] of l.groups.entries()){
  if(g.group.parent)expect(contains(l.groups.find(p=>p.group.id===g.group.parent)!,g)).toBe(true);
  for(const n of l.nodes){if(groupContains(m,g.group.id,n.node.group))expect(contains(g,n)).toBe(true);else expect(boxesOverlap(g,n)).toBe(false);}
  for(const h of l.groups.slice(i+1))if(!groupContains(m,g.group.id,h.group.id)&&!groupContains(m,h.group.id,g.group.id))expect(boxesOverlap(g,h)).toBe(false);
 }
 for(const e of l.edges)for(let k=1;k<e.points.length;k++){
  for(const n of l.nodes){if(n.node.id===e.edge.from&&k===1||n.node.id===e.edge.to&&k===e.points.length-1)continue;expect(segmentIntersectsBox(e.points[k-1],e.points[k],n,-1),`${e.edge.from} -> ${e.edge.to} hits ${n.node.id}`).toBe(false);}
  for(const g of l.groups){const header={x:g.x+16,y:g.y+9,width:Math.min(g.width-32,textWidth(g.group.label,OUTPUT_THEME.groupFontSize)),height:wrapText(g.group.label,g.width-34,OUTPUT_THEME.groupFontSize).length*17+5};expect(segmentIntersectsBox(e.points[k-1],e.points[k],header,0),`header ${g.group.id}`).toBe(false);}
 }
 if(name==='nested-directions-grid'){const g=l.groups.find(g=>g.group.id==='Other')!;expect(g.width).toBeLessThan(500);expect(l.width).toBeLessThan(4000);}
});
it.each([
 {Parent:{grid:{columns:2,items:[{id:'unknown'}]}}},
 {Parent:{grid:{columns:2,items:[{id:'a'},{id:'a'}]}}},
 {Parent:{grid:{columns:2,items:[{id:'a'},{id:'b',rowSpan:0}]}}},
 {Missing:{grid:{columns:2,items:[{id:'a'}]}}},
])('validates per-parent grids %j',async groups=>{
 const m=await parseDiagram(`%% archmap: ${JSON.stringify({groups})}\nflowchart LR\nsubgraph Parent\na[A] --> b[B]\nend`);expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('supports direct nodes, equal tracks, spans and collapsed nested grids',async()=>{
 const meta={groups:{P:{grid:{columns:2,sizing:'equal',items:[{id:'a'},{id:'B',rowSpan:2},{id:'c'}]}},B:{grid:{columns:1,items:[{id:'b'}]}}}};
 for(const collapsed of ['', '\nB@{view: collapsed}']){
  const m=await parseDiagram(`%% archmap: ${JSON.stringify(meta)}\nflowchart LR\nsubgraph P\na[A]\nc[C]\nsubgraph B\nb[B]\nend\nend\na --> B${collapsed}`);
  expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.svg).not.toMatch(/NaN|Infinity/);expect(r.layout.edges).toHaveLength(1);
 }
});
