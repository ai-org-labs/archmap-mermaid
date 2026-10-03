import {expect,it,beforeAll} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {computeDiagramLayout} from '../src/focused/layout.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
beforeAll(installDiagramIcons);
const chain=(dir:string)=>`flowchart ${dir}\nA-->B-->C-->D-->E-->F-->G-->H`;
it.each(['LR','RL','TB','BT'])('reduces long %s diagrams without shrinking nodes or bending their spine',async dir=>{
 const model=await parseDiagram(chain(dir));const before=computeDiagramLayout(model,{balance:'off'}),after=computeDiagramLayout(model);
 const horizontal=['LR','RL'].includes(dir),dimension=horizontal?'width':'height',position=horizontal?'x':'y';
 expect(after[dimension]).toBeLessThan(before[dimension]);
 for(const n of after.nodes){const old=before.nodes.find(o=>o.node.id===n.node.id)!;expect(n.width).toBe(old.width);expect(n.height).toBe(old.height);}
 for(const e of after.edges){expect(e.points).toHaveLength(2);const a=after.nodes.find(n=>n.node.id===e.edge.from)!,b=after.nodes.find(n=>n.node.id===e.edge.to)!;expect((b[position]-a[position])*(dir==='RL'||dir==='BT'?-1:1)).toBeGreaterThan(0);}
 expect(renderDiagram(model).model.diagnostics).toEqual([]);
 expect(model.direction).toBe(dir==='TB'?'TD':dir);
});
it.each(['sequenceDiagram\nA->>B: Request\nB-->>A: Response','%% archmap: {"view":"layers"}\nflowchart TB\nsubgraph Service\nA-->B\nend','%% archmap: {"nodes":{"A":{"at":[1,1]}}}\n'+chain('LR')])('preserves authored coordinates and special view order',async source=>{
 const model=await parseDiagram(source);expect(computeDiagramLayout(model)).toEqual(computeDiagramLayout(model,{balance:'off'}));
});
it('keeps a diagram already near its target unchanged',async()=>{
 const square=await parseDiagram('flowchart TB\nA-->B & C & D\nB & C & D-->E');const layout=computeDiagramLayout(square,{balance:'off'});
 expect(computeDiagramLayout(square,{targetAspectRatio:layout.width/layout.height})).toEqual(layout);
});
it('accepts portrait targets and rejects nonsensical target ratios',async()=>{
 const model=await parseDiagram(chain('TB'));expect(computeDiagramLayout(model,{targetAspectRatio:0.75}).height).toBeLessThan(computeDiagramLayout(model,{balance:'off'}).height);
 for(const value of [0,-1,NaN,Infinity,0.1,5])expect(()=>computeDiagramLayout(model,{targetAspectRatio:value})).toThrow(RangeError);
});
it('keeps long labels, nested boundaries and icons clear',async()=>{
 const source=`%% archmap: {"style":"icons"}
flowchart TB
subgraph Outer
 direction TB
 subgraph Ingress
 direction LR
 A@{ icon: "server", label: "Ingress" } --> B[Validate]
 end
 subgraph Processing
 direction TB
 C[Process] --> D[Persist]
 end
 B -->|all checks passed and the request is ready for processing| C
end
D-->E[Respond]`;
 const model=await parseDiagram(source);expect(model.diagnostics).toEqual([]);
 const before=renderDiagram(model,{balance:'off'}),after=renderDiagram(model);
 expect(after.model.diagnostics).toEqual(before.model.diagnostics);
 expect(after.layout.nodes.map(n=>n.node.id)).toEqual(before.layout.nodes.map(n=>n.node.id));
 expect(after.layout.edges.map(e=>[e.edge.from,e.edge.to,e.edge.label])).toEqual(before.layout.edges.map(e=>[e.edge.from,e.edge.to,e.edge.label]));
});
it('bounds candidate work on large diagrams',async()=>{
 const model=await parseDiagram('flowchart LR\n'+Array.from({length:81},(_,i)=>`N${i}`).join('-->'));
 expect(computeDiagramLayout(model)).toEqual(computeDiagramLayout(model,{balance:'off'}));
});
