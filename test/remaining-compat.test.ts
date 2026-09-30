import {beforeAll,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {boxesOverlap} from '../src/focused/layout.js';
beforeAll(installDiagramIcons);
async function render(source:string){const m=await parseDiagram(source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);const r=renderDiagram(m);expect(r.svg).not.toMatch(/NaN|Infinity/);return r;}
it.each(['LR','RL','TB','BT'])('supports nested subgraph directions in a %s diagram',async dir=>{
 const {layout,model}=await render(`flowchart ${dir}
subgraph Outer
 direction TB
 subgraph Inner
 direction RL
 A-->B
 end
 C-->D
 Inner-->C
end
Outside-->Outer
Outer-->End`);
 expect(model.diagnostics).toEqual([]);
 const n=(id:string)=>layout.nodes.find(n=>n.node.id===id)!;
 expect(n('A').x).toBeGreaterThan(n('B').x);expect(n('C').y).toBeLessThan(n('D').y);
 const inner=layout.groups.find(g=>g.group.id==='Inner')!;
 expect(inner.y+inner.height).toBeLessThan(n('C').y);
 for(let i=0;i<layout.nodes.length;i++)for(const b of layout.nodes.slice(i+1))expect(boxesOverlap(layout.nodes[i],b)).toBe(false);
 expect(layout.edges).toHaveLength(5);
});
const halves=["-|\\", "-|/", "-\\\\", "-//", "/|-", "\\|-", "//-", "\\\\-"];
it.each(halves.flatMap(a=>[a,a.replace('-', '--')]))('preserves half-arrow %s',async arrow=>{
 const {model,svg}=await render(`sequenceDiagram\nA${arrow}B: Request`);
 const e=model.edges[0];expect(e.sourceMarker||e.targetMarker).toMatch(/half/);expect(e.arrow).toBe('none');expect(e.style).toBe(arrow.includes('--')?'dashed':'solid');expect(svg).toContain(`url(#archmap-${e.sourceMarker||e.targetMarker})`);
});
it.each(['A->>()B: Request','A()->>B: Request','A()<<->>()B: Request'])('preserves central connections and activations (%s)',async body=>{
 const {model,layout,svg}=await render('sequenceDiagram\n'+body);
 expect(model.edges[0].central).toBeDefined();expect(layout.activations??[]).toHaveLength(0);expect(svg).toContain('archmap-central-connection');
});
it.each(['boundary','control','entity','collections','queue','database','actor'])('renders participant stereotype %s',async type=>{
 const {model,svg}=await render(`sequenceDiagram\nparticipant A@{ "type": "${type}" }\nA->>B: Request`);
 expect(model.nodes[0].participantType).toBe(type);if(!['database','actor'].includes(type))expect(svg).toContain(`data-type="${type}"`);
});
it('renders participant links and properties as readable portable SVG content',async()=>{
 const {model,svg,layout}=await render(`sequenceDiagram
participant A as API
link A: Documentation @ https://example.com/docs
links A: {"Dashboard":"https://example.com/status"}
properties A: {"owner":"Platform","tier":"critical"}
A->>B: Request`);
 expect(model.nodes[0].links).toHaveLength(2);expect(svg).toContain('href="https://example.com/docs"');expect(svg).toContain('owner: Platform');expect(layout.nodes[0].height).toBeGreaterThan(100);
});
it('does not emit executable participant URLs',async()=>{
 const {svg}=await render('sequenceDiagram\nA->>B: Hi\nlinks A: {"Unsafe":"javascript:alert(1)","Docs":"https://example.com"}');
 expect(svg).not.toContain('javascript:');expect(svg).toContain('href="https://example.com"');
});
it('combines central connections with explicit activation intervals',async()=>{
 const {layout,model}=await render('sequenceDiagram\nactivate B\nA->>()B: Request\nB-->>A: Response\ndeactivate B');
 expect(model.edges[0].central).toBe('target');expect(layout.activations).toHaveLength(1);const b=layout.nodes.find(n=>n.node.id==='B')!;expect(layout.edges[0].points[layout.edges[0].points.length-1]?.x).toBe(b.x+b.width/2);
});
it.each([
'---\ntitle: Example\nconfig:\n  theme: dark\n  sequence:\n    showSequenceNumbers: true\n---\nsequenceDiagram\nA->>B: Request',
'%%{init: {"theme":"dark","sequence":{"showSequenceNumbers":true}}}%%\nsequenceDiagram\nA->>B: Request'
])('accepts standard display configuration without losing the diagram',async source=>{
 const {model}=await render(source);expect(model.edges[0].label).toBe('1. Request');
});
it('does not allow source configuration to weaken SVG escaping',async()=>{
 const {svg}=await render('%%{init: {"securityLevel":"loose","themeCSS":"body{display:none}"}}%%\nflowchart LR\nA["<script>alert(1)</script>"]-->B');
 expect(svg).not.toContain('<script>');expect(svg).not.toContain('body{');
});
it('preserves a composite state local direction',async()=>{
 const {layout}=await render('stateDiagram-v2\ndirection LR\nstate Outer {\n direction BT\n A-->B\n}\nOuter-->Done');
 expect(layout.nodes.find(n=>n.node.id==='A')!.y).toBeGreaterThan(layout.nodes.find(n=>n.node.id==='B')!.y);
});
it('projects collapsed subgraphs without losing the source graph',async()=>{
 const {model,layout,svg}=await render(`flowchart LR
subgraph Services
 subgraph Inner
 A-->B
 end
end
Services@{ view: collapsed }
Client-->A
B-->Result`);
 expect(model.nodes).toHaveLength(4);expect(layout.nodes.map(n=>n.node.id)).toEqual(['Client','Result']);expect(layout.groups.map(g=>g.group.id)).toEqual(['Services']);
 expect(layout.edges.map(e=>[e.edge.from,e.edge.to])).toEqual([['Client','Services'],['Services','Result']]);expect(svg).toContain('⋯');
});
it('renders a standalone empty subgraph',async()=>{
 const {layout}=await render('flowchart LR\nsubgraph Empty[Reserved]\nend');expect(layout.groups).toHaveLength(1);expect(layout.nodes).toHaveLength(0);
});
