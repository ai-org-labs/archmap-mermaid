import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {boxesOverlap} from '../src/focused/layout.js';
const parse=(meta:object,body='A --> B')=>parseDiagram('%% archmap: '+JSON.stringify({view:'overview',...meta})+'\nflowchart LR\n'+body);
it('colors both line and arrow and preserves default overrides',async()=>{
 const m=await parse({},'A --> B --> C\nlinkStyle default stroke:#64748b\nlinkStyle 0 stroke:#d65a23,stroke-width:5px');
 expect(m.diagnostics).toEqual([]);expect(m.edges.map(e=>e.stroke)).toEqual(['#d65a23','#64748b']);
 const svg=renderDiagram(m).svg;
 expect(svg.match(/class="archmap-edge"[^>]*stroke="#d65a23"/)).toBeTruthy();
 expect(svg.match(/class="archmap-sized-arrow"[^>]*stroke="#d65a23"/)).toBeTruthy();
});
it('colors circle and cross markers, not shared global markers',async()=>{
 const m=await parse({},'A --o B\nB --x C\nlinkStyle 0 stroke:red\nlinkStyle 1 stroke:green');
 const svg=renderDiagram(m).svg;
 expect(svg).toContain('id="archmap-circle-edge-1"');expect(svg).toContain('id="archmap-cross-edge-2"');
 expect(svg.match(/id="archmap-circle-edge-1"[^]*?<\/marker>/)?.[0]).toContain('stroke="red"');
});
it.each([['h1',36],['h2',30],['h3',26],['h4',22],['h5',18],['h6',16],[42,42]])('sizes node and edge callouts %s',async(size,font)=>{
 const m=await parse({nodes:{A:{callout:'Origin',calloutSize:size},B:{callout:'Destination',calloutSize:size}},edges:{0:{callout:'Change',calloutSize:size}}});
 expect(m.diagnostics).toEqual([]);const before=JSON.stringify(m),r=renderDiagram(m);
 expect(JSON.stringify(m)).toBe(before);expect(r.svg).toContain('font-size="'+font+'"');
 const c=r.layout.edgeCallouts![0];expect(c.fontSize).toBe(font);expect(c.x+c.width).toBeLessThanOrEqual(r.layout.width);
 expect(r.layout.nodes.some(n=>boxesOverlap(c,n))).toBe(false);
 expect(r.layout.edges).toHaveLength(1);expect(r.layout.nodes).toHaveLength(2);
});
it.each([0,49,'h7','36px','<script>'])('rejects invalid size %s',async size=>{
 const m=await parse({edges:{0:{callout:'Message',calloutSize:size}}});expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('escapes annotations and expands for long text',async()=>{
 const m=await parse({edges:{0:{callout:'<script>danger</script>'.repeat(10),calloutSize:48}}});
 const r=renderDiagram(m);expect(r.svg).not.toContain('<script>');expect(r.layout.edgeCallouts![0].height).toBeGreaterThan(100);
});
it('preserves edge labels and separate callouts',async()=>{
 const r=renderDiagram(await parse({edges:{0:{routing:'straight',callout:'Change'}}},'A -->|request| B'));
 expect(r.svg).toContain('request');expect(r.svg).toContain('Change');expect(r.layout.edges[0].labelBox).toBeDefined();
 expect(boxesOverlap(r.layout.edgeCallouts![0],r.layout.edges[0].labelBox!)).toBe(false);
});
it('rejects unsafe stroke values',async()=>{
 const m=await parse({},'A --> B\nlinkStyle 0 stroke:url(https://example.com)');
 expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
