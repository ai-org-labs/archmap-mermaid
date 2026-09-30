import {beforeAll,expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {FLOW_SHAPES} from '../src/focused/flow-shapes.js';
import {boxesOverlap} from '../src/focused/layout.js';
beforeAll(installDiagramIcons);
async function render(source:string){const m=await parseDiagram(source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);const r=renderDiagram(m);expect(r.svg).not.toMatch(/NaN|Infinity/);return r;}
it.each(['LR','RL','TB','BT'])('lays out %s with correct edge direction',async direction=>{
 const {layout}=await render(`flowchart ${direction}\nA-->B-->C`);
 const [a,b,c]=['A','B','C'].map(id=>layout.nodes.find(n=>n.node.id===id)!);
 const axis=direction==='LR'||direction==='RL'?'x':'y',sign=direction==='RL'||direction==='BT'?-1:1;
 expect((b[axis]-a[axis])*sign).toBeGreaterThan(0);expect((c[axis]-b[axis])*sign).toBeGreaterThan(0);
 expect(layout.edges.every(e=>e.points.length===2)).toBe(true);
});
it.each([...new Set(Object.values(FLOW_SHAPES))])('renders the standard %s shape',async shape=>{
 const r=await render(`flowchart LR\nA@{ shape: ${shape}, label: "Example" } --> B[Destination]`);
 expect(r.model.nodes[0].flowShape).toBe(shape);expect(r.svg).toContain('Example');
});
it('preserves invisible, thick, circle and cross edges',async()=>{
 const {layout,svg}=await render('flowchart LR\nA o--o B\nB x--x C\nC ==> D\nD ~~~ E');
 expect(layout.edges).toHaveLength(4);expect((svg.match(/class="archmap-edge"/g)||[])).toHaveLength(3);
 expect(svg).toContain('marker-start="url(#archmap-circle)"');expect(svg).toContain('stroke-width="3.2"');
});
it('reserves chronological space for notes and nested critical/break/rect frames',async()=>{
 const {layout,svg}=await render(`sequenceDiagram
participant A
participant B
Note left of A: Start here
rect rgb(200,220,240)
critical Save
A-xB: lost
option Retry
Note over A,B: Confirm before retry
B--xA: failed
end
break Stop processing
A->>B: stop
end
end
Note right of B: Done`);
 expect(layout.notes).toHaveLength(3);expect(layout.fragments?.map(f=>f.kind)).toEqual(['rect','critical','break']);
 expect(layout.fragments?.find(f=>f.kind==='critical')?.branches).toHaveLength(1);
 for(const n of layout.notes!){expect(n.x).toBeGreaterThanOrEqual(0);expect(n.x+n.width).toBeLessThanOrEqual(layout.width);for(const e of layout.edges)expect(e.points[0].y<n.y||e.points[0].y>n.y+n.height).toBe(true);}
 expect(svg).toContain('archmap-cross');
});
it('positions created actors at the creation message and stops destroyed lifelines',async()=>{
 const {layout,svg}=await render(`sequenceDiagram
box Service
participant A
participant B
end
A->>B: first
create participant C
B->>C: create
destroy C
C-->>B: complete`);
 const c=layout.nodes.find(n=>n.node.id==='C')!,creation=layout.edges[1];
 expect(c.y+c.height/2).toBe(creation.points[1].y);expect(creation.points[1].x).toBe(c.x);
 expect(layout.destructions?.[0].y).toBe(layout.edges[2].points[0].y);expect(svg).toContain('archmap-destruction');
 expect(layout.groups).toHaveLength(1);expect(layout.groups[0].y).toBeLessThan(layout.nodes[0].y);
});
it('keeps state notes out of screen actions and concurrent regions distinct',async()=>{
 const {model,layout,svg}=await render(`stateDiagram-v2
state Running {
[*] --> A
A --> B
--
[*] --> C
C --> D
}
note left of A: Left annotation
note right of D: Right annotation`);
 expect(model.nodes.filter(n=>n.noteTarget)).toHaveLength(2);
 expect(model.groups.filter(g=>g.concurrent)).toHaveLength(2);expect(svg).toContain('data-concurrent="true"');
 for(const n of model.nodes.filter(n=>n.noteTarget)) {
  const note=layout.nodes.find(a=>a.node.id===n.id)!,target=layout.nodes.find(a=>a.node.id===n.noteTarget)!;
  expect(n.notePosition==='left'?note.x<target.x:note.x>target.x).toBe(true);
  expect(target.screen?.actions.some(a=>a.edge?.to===n.id)).toBe(false);
  expect(boxesOverlap(note,target)).toBe(false);
 }
 expect(model.edges.filter(e=>model.nodes.some(n=>n.id===e.to&&n.noteTarget)).every(e=>e.arrow==='none'&&e.style==='dashed')).toBe(true);
});
it('attaches multiline notes to composite state boundaries',async()=>{
 const {model,layout}=await render(`stateDiagram-v2
state Parent {
 A --> B
}
note left of Parent
 A composite state
 with a multiline note
end note`);
 const note=layout.nodes.find(n=>n.node.noteTarget==='Parent')!,group=layout.groups.find(g=>g.group.id==='Parent')!;
 expect(note).toBeDefined();expect(note.x+note.width).toBeLessThan(group.x);expect(model.nodes.find(n=>n.noteTarget)?.label).toContain('multiline');
});
it('does not collide automatic reverse-direction nodes with authored coordinates',async()=>{
 const {layout}=await render('%% archmap: {"nodes":{"A":{"at":[1,1]}}}\nflowchart RL\nA-->B-->C');
 for(let i=0;i<layout.nodes.length;i++)for(const b of layout.nodes.slice(i+1))expect(boxesOverlap(layout.nodes[i],b)).toBe(false);
});
