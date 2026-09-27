import {describe,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {segmentIntersectsBox} from '../src/focused/layout.js';
import type {DiagramBox,DiagramPoint} from '../src/focused/types.js';
const boundary=(p:DiagramPoint,b:DiagramBox)=>((Math.abs(p.x-b.x)<.01||Math.abs(p.x-b.x-b.width)<.01)&&p.y>=b.y&&p.y<=b.y+b.height)||((Math.abs(p.y-b.y)<.01||Math.abs(p.y-b.y-b.height)<.01)&&p.x>=b.x&&p.x<=b.x+b.width);
describe('compound endpoints',()=>{
 it.each([
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nG --> B[Store]',
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nB[Client] -->|request| G',
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nsubgraph H[Storage]\n B[Database]\nend\nG -->|request| H',
  'flowchart LR\nsubgraph G[Outer]\nsubgraph H[Inner]\n A[Worker]\nend\nend\nB[Client] --> H\nG --> B',
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nG -->|activate| A',
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nA -->|report| G',
  'flowchart LR\nsubgraph G[Service]\n A[Worker]\nend\nG -->|retry| G',
  'flowchart LR\nsubgraph G[Outer]\nsubgraph H[Inner]\n A[Worker]\nend\nend\nG --> H\nH --> G',
  'stateDiagram-v2\nstate Service {\n [*] --> Idle\n}\n[*] --> Service\nService --> Done',
 ].flatMap(source => source.startsWith('flowchart LR') ? [source, source.replace('flowchart LR','flowchart TD')] : [source]))('preserves group endpoints: %s',async source=>{
  const m=await parseDiagram(source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
  const result=renderDiagram(m),l=result.layout;
  expect(l.edges).toHaveLength(m.edges.length);
  expect(result.svg).not.toMatch(/NaN|Infinity/);
  for(const e of l.edges){
   for(const [id,p] of [[e.edge.from,e.points[0]!],[e.edge.to,e.points[e.points.length-1]!]] as const){const g=l.groups.find(g=>g.group.id===id);if(g)expect(boundary(p,g)).toBe(true);}
   for(let k=1;k<e.points.length;k++)for(const n of l.nodes){
    if(n.node.id===e.edge.from&&k===1||n.node.id===e.edge.to&&k===e.points.length-1)continue;
    expect(segmentIntersectsBox(e.points[k-1]!,e.points[k]!,n,-1)).toBe(false);
   }
  }
 });
});
