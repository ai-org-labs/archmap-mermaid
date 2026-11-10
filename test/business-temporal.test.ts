import {beforeAll,expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {boxesOverlap,segmentIntersectsBox} from '../src/focused/layout.js';
import {DIAGRAM_SAMPLES} from '../src/focused/samples.js';
beforeAll(installDiagramIcons);
it.each(['overview','timeline','eventmodeling'])('renders %s without losing information',async kind=>{
 const m=await parseDiagram(DIAGRAM_SAMPLES.find(s=>s.id===kind)!.source);expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);
 expect(r.svg).not.toMatch(/NaN|Infinity/);expect(r.model.diagnostics).toEqual([]);
 for(const [i,n] of r.layout.nodes.entries()){
  expect(n.x+n.width).toBeLessThanOrEqual(r.layout.width);expect(n.y+n.height).toBeLessThanOrEqual(r.layout.height);
  for(const other of r.layout.nodes.slice(i+1))expect(boxesOverlap(n,other)).toBe(false);
 }
 for(const e of r.layout.edges)for(let i=1;i<e.points.length;i++)for(const n of r.layout.nodes){if([e.edge.from,e.edge.to].includes(n.node.id))continue;expect(segmentIntersectsBox(e.points[i-1],e.points[i],n)).toBe(false);}
});
it('overview is presentation only and escapes callouts',async()=>{
 const src='flowchart LR\nA[Input] --> B[Output]';const ordinary=await parseDiagram(src);
 const m=await parseDiagram('%% archmap: {"view":"overview","nodes":{"B":{"emphasis":"changed","callout":"<script>alert(1)</script>"}}}\n'+src);
 expect(m.edges).toEqual(ordinary.edges);const r=renderDiagram(m);expect(r.svg).toContain('font-size="24"');expect(r.svg).toContain('font-size="22"');expect(r.svg).not.toContain('<script>');expect(r.svg).toContain('変更');
});
it.each(['"emphasis":"bogus"','"callout":42','"callout":""'])('rejects invalid annotation %s',async field=>{
 const m=await parseDiagram(`%% archmap: {"view":"overview","nodes":{"A":{${field}}}}\nflowchart LR\nA`);expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('preserves timeline sections, multiple events, multiline events and source order',async()=>{
 const m=await parseDiagram('timeline\nsection One\nLater : A : B\n : C\nsection Two\nEarlier : D');expect(m.diagnostics).toEqual([]);expect(m.nodes.map(n=>n.label)).toEqual(['Later','Earlier']);expect(m.nodes[0].description).toBe('A\nB\nC');expect(m.nodes[1].temporal?.lane).toBe('Two');
});
it('event reset breaks inference; explicit sources and repeated entities retain frame identity',async()=>{
 const m=await parseDiagram('eventmodeling\ntf 01 ui Cart\ntf 02 cmd Add\ntf 03 evt Added\nrf 04 evt Added\ntf 05 rmo Cart ->> 03 ->> 04');
 expect(m.diagnostics).toEqual([]);expect(m.nodes.map(n=>n.id)).toEqual(['01','02','03','04','05']);expect(m.edges.map(e=>[e.from,e.to])).toEqual([['01','02'],['02','03'],['03','05'],['04','05']]);
});
it('keeps external data as text and rejects unknown frame references',async()=>{
 const m=await parseDiagram('eventmodeling\ntf 01 cmd Add [[Payload]]\ndata Payload {\n name: string\n}');expect(m.diagnostics).toEqual([]);expect(m.nodes[0].description).toContain('name: string');
 const bad=await parseDiagram('eventmodeling\ntf 01 rmo View ->> 99');expect(bad.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('keeps Mermaid 12.3 namespace inference independent of visual lane merging',async()=>{
 const m=await parseDiagram('eventmodeling\ntf 01 evt Sales.Created\ntf 02 evt Sales.Updated');expect(m.diagnostics).toEqual([]);expect(m.edges.map(e=>[e.from,e.to])).toEqual([['01','02']]);expect(m.nodes[0].group).toBe(m.nodes[1].group);
});
it.each(['LR','RL','TB','BT'])('overview reserves long callouts with nested groups in %s',async direction=>{
 const source='%% archmap: '+JSON.stringify({view:'overview',nodes:{A:{emphasis:'changed',callout:'業務への影響と変更内容を確認する。'.repeat(7)},B:{emphasis:'new',callout:'追加機能'}}})+`\nflowchart ${direction}\nsubgraph P[業務]\nsubgraph C[対象]\nA[とても長いシステム名称の表示確認] --> B[追加]\nend\nend`;
 const m=await parseDiagram(source);expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.model.diagnostics).toEqual([]);for(const n of r.layout.nodes)expect(n.y+n.height).toBeLessThanOrEqual(r.layout.height);
});
it('overview projects Mermaid shapes to measured cards without mutating the input model',async()=>{
 const m=await parseDiagram('%% archmap: {"view":"overview","nodes":{"A":{"callout":"確認ポイント"}}}\nflowchart LR\nA@{ shape: fork, label: "Parallel" } --> B[(Data)]');expect(m.diagnostics).toEqual([]);const before=JSON.stringify(m),r=renderDiagram(m);expect(JSON.stringify(m)).toBe(before);expect(r.layout.nodes.every(n=>n.width===320)).toBe(true);expect(r.svg).toContain('確認ポイント');
});
