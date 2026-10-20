import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
const overlap=(a:any,b:any)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
it.each(['nested-directions','nested-directions-grid'])('%s preserves alternating directions and containment',async name=>{
 const m=await parseDiagram(readFileSync(`docs/diagrams/group-grid/${name}.mmd`,'utf8'));
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const {layout:l,svg}=renderDiagram(m);expect(svg).not.toMatch(/NaN|Infinity/);expect(l.edges).toHaveLength(m.edges.length);
 for(let i=0;i<6;i++){
  const a=l.nodes.find(n=>n.node.id===`n${i}a`)!,b=l.nodes.find(n=>n.node.id===`n${i}b`)!;
  if(i%2===0){expect(b.x).toBeGreaterThan(a.x);expect(b.y).toBe(a.y);}else{expect(b.y).toBeGreaterThan(a.y);expect(b.x).toBe(a.x);}
 }
 for(const g of l.groups){
  if(g.group.parent){const p=l.groups.find(p=>p.group.id===g.group.parent)!;expect(g.x).toBeGreaterThanOrEqual(p.x);expect(g.y).toBeGreaterThan(p.y);expect(g.x+g.width).toBeLessThanOrEqual(p.x+p.width);expect(g.y+g.height).toBeLessThanOrEqual(p.y+p.height);}
  for(const n of l.nodes.filter(n=>n.node.group===g.group.parent))expect(overlap(g,n)).toBe(false);
 }
});
