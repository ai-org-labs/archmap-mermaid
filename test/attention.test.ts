import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
const source=(meta:object)=>'%% archmap: '+JSON.stringify({view:'overview',...meta})+'\nflowchart LR\nA[LAN] --> B[PC]\nB --> C[Monitor]\nstyle A fill:yellow,stroke:blue\nlinkStyle default stroke:purple,stroke-width:8px';
it('neutralizes context while retaining data and source styling',async()=>{
 const m=await parseDiagram(source({nodes:{B:{attention:'problem'},C:{attention:'focus'}}}));
 const before=JSON.stringify(m),r=renderDiagram(m);
 expect(JSON.stringify(m)).toBe(before);expect(r.model).toEqual(m);
 expect(r.layout.nodes.find(n=>n.node.id==='A')!.node.paint!.fill).toBe('#fafafa');
 expect(r.layout.nodes.find(n=>n.node.id==='B')!.node.paint!.stroke).toBe('#c52d32');
 expect(r.layout.nodes.find(n=>n.node.id==='C')!.node.paint!.stroke).toBe('#087f72');
 expect(r.layout.edges.every(e=>e.edge.stroke==='#737373'&&e.edge.strokeWidth===1.4)).toBe(true);
 expect(m.nodes[0].paint!.fill).toBe('yellow');expect(r.layout.edges).toHaveLength(2);
 expect(r.svg).toContain('font-size="20"');expect(r.svg).toContain('font-size="26"');
});
it('highlights only explicitly selected edges',async()=>{
 const m=await parseDiagram(source({edges:{1:{attention:'problem',callout:'Blocked'}}}));
 const r=renderDiagram(m);expect(r.layout.edges[0].edge.stroke).toBe('#737373');
 expect(r.layout.edges[1].edge.stroke).toBe('#c52d32');
 expect(r.layout.edgeCallouts![0].fontSize).toBe(28);
});
it('leaves normal colors intact without attention',async()=>{
 const r=renderDiagram(await parseDiagram(source({})));
 expect(r.layout.nodes[0].node.paint!.fill).toBe('yellow');
 expect(r.layout.edges[0].edge.stroke).toBe('purple');
});
it('preserves explicit callout size and independent change status',async()=>{
 const r=renderDiagram(await parseDiagram(source({nodes:{B:{attention:'context',emphasis:'new',callout:'Existing note',calloutSize:32},C:{attention:'focus'}}})));
 expect(r.svg).toContain('新規');expect(r.svg).toContain('font-size="32"');
 expect(r.layout.nodes.find(n=>n.node.id==='B')!.node.emphasis).toBe('new');
});
it.each(['urgent',42,null])('rejects invalid attention %s',async attention=>{
 const m=await parseDiagram(source({nodes:{A:{attention}}}));
 expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('grays context imagery and group boundaries',async()=>{
 const m=await parseDiagram('%% archmap: {"view":"overview","nodes":{"B":{"attention":"focus"}}}\nflowchart LR\nsubgraph G[Cloud]\nA --> B\nend\nstyle G fill:yellow,stroke:red');
 const r=renderDiagram(m);expect(r.layout.groups[0].group.paint!.fill).toBe('#fafafa');
 expect(r.svg).toContain('filter="url(#archmap-context-gray)"');
});
