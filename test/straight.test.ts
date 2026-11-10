import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {segmentIntersectsBox} from '../src/focused/layout.js';
const parse=(meta:object,body='A --> B\nB --> C')=>parseDiagram('%% archmap: '+JSON.stringify(meta)+'\nflowchart LR\n'+body);
it.each(['LR','RL','TB','BT'])('direct connections retain two boundary endpoints in %s',async direction=>{
 const m=await parseDiagram('%% archmap: {"routing":"straight"}\nflowchart '+direction+'\nA --> B --> C');
 const before=JSON.stringify(m),r=renderDiagram(m);
 expect(JSON.stringify(m)).toBe(before);
 for(const e of r.layout.edges){expect(e.points).toHaveLength(2);expect(e.points[0]).not.toEqual(e.points[1]);}
});
it('supports diagonal lines and individual orthogonal overrides',async()=>{
 const m=await parse({routing:'straight',edges:{'1':{routing:'orthogonal'}},nodes:{A:{at:[1,1]},B:{at:[2,2]},C:{at:[3,1]}}});
 const r=renderDiagram(m),e=r.layout.edges[0];expect(e.points).toHaveLength(2);
 expect(e.points[0].x).not.toBe(e.points[1].x);expect(e.points[0].y).not.toBe(e.points[1].y);
 expect(m.edges[1].routing).toBe('orthogonal');
});
it('accepts standard default, multiple indices and decimal stroke widths',async()=>{
 const m=await parse({},'A --> B --> C --> D\nlinkStyle default stroke-width:3px\nlinkStyle 0,2 stroke-width:6.5px');
 expect(m.diagnostics).toEqual([]);expect(m.edges.map(e=>e.strokeWidth)).toEqual([6.5,3,6.5]);
 expect(renderDiagram(m).svg).toContain('stroke-width="6.5"');
});
it.each(['0','-1','17','NaN','2em'])('rejects invalid width %s',async width=>{
 const m=await parse({},'A --> B\nlinkStyle 0 stroke-width:'+width);expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('warns when a self loop cannot be straightened',async()=>{
 const r=renderDiagram(await parse({routing:'straight'},'A --> A'));
 expect(r.model.diagnostics.some(d=>d.message.includes('直線化できない'))).toBe(true);
});
it('detects diagonal obstacle crossings',()=>{
 expect(segmentIntersectsBox({x:0,y:0},{x:100,y:100},{x:40,y:40,width:20,height:20})).toBe(true);
 expect(segmentIntersectsBox({x:0,y:0},{x:100,y:100},{x:40,y:70,width:10,height:10})).toBe(false);
});
it('keeps dashed and bidirectional semantics',async()=>{
 const m=await parse({routing:'straight'},'A -.-> B\nB <--> C\nlinkStyle default stroke-width:4');
 const r=renderDiagram(m);expect(r.svg).toContain('stroke-dasharray="6 5"');expect(m.edges[1].bidirectional).toBe(true);expect((r.svg.match(/class="archmap-sized-arrow"/g)||[])).toHaveLength(3);expect(r.svg).toContain('stroke-width="4"');
});
it('connects overview body, not its callout',async()=>{
 const m=await parse({view:'overview',routing:'straight',nodes:{A:{callout:'Important'},B:{at:[2,2]}}},'A --> B');
 const r=renderDiagram(m);expect(r.layout.edges[0].points).toHaveLength(2);expect(r.svg).toContain('Important');
});

it('reports direct lines crossing their own callout',async()=>{
 const r=renderDiagram(await parse({view:'overview',routing:'straight',nodes:{A:{at:[1,2]},B:{at:[2,1],callout:'Notice'}}},'A --> B'));
 expect(r.model.diagnostics.some(d=>d.message.includes('吹き出しに重な'))).toBe(true);
});
