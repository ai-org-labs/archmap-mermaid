import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
const source=readFileSync('docs/diagrams/group-grid/transparency/alpha30.mmd','utf8');
it.each(['LR','RL','TB','BT'])('nested borders remain distinct from connection lines: %s',async direction=>{
 const m=await parseDiagram(source.replace('flowchart TB',`flowchart ${direction}`));
 expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.layout.edges).toHaveLength(2);
 for(const e of r.layout.edges)for(let i=1;i<e.points.length;i++){
  const a=e.points[i-1],b=e.points[i];
  for(const g of r.layout.groups){
   if(a.x===b.x&&(Math.abs(a.x-g.x)<4||Math.abs(a.x-g.x-g.width)<4))expect(Math.min(Math.max(a.y,b.y),g.y+g.height)-Math.max(Math.min(a.y,b.y),g.y),'vertical boundary').toBeLessThanOrEqual(0);
   if(a.y===b.y&&(Math.abs(a.y-g.y)<4||Math.abs(a.y-g.y-g.height)<4))expect(Math.min(Math.max(a.x,b.x),g.x+g.width)-Math.max(Math.min(a.x,b.x),g.x),'horizontal boundary').toBeLessThanOrEqual(0);
  }
 }
});
