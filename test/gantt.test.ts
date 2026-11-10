import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {computeDiagramLayout,segmentIntersectsBox} from '../src/focused/layout.js';
const parse=(body:string)=>parseDiagram('gantt\n dateFormat YYYY-MM-DD\n todayMarker off\n'+body);
it('retains real calendar times, sections, statuses and multiple predecessors',async()=>{
 const m=await parse('title 計画\nsection 設計\n要件 :done, a, 2026-11-02, 2d\n方式 :active, b, 2026-11-02, 3d\nsection 実装\n実装 :crit, c, after a b, 5d\n公開 :milestone, d, after c, 0d');
 expect(m.diagnostics).toEqual([]);expect(m.kind).toBe('gantt');expect(m.nodes[2].gantt!.start).toBe(m.nodes[1].gantt!.end);expect(m.edges.map(e=>[e.from,e.to])).toEqual([['a','c'],['b','c'],['c','d']]);
 const r=renderDiagram(m);expect(r.svg).not.toMatch(/NaN|Infinity|undefined/);expect(r.svg).toContain('archmap-gantt-milestone');expect(r.svg).toContain('計画');expect(computeDiagramLayout(m)).toEqual(r.layout);
});
it('uses official excludes/includes and inclusive end dates arithmetic',async()=>{
 const m=await parse('excludes weekends\nA :a, 2026-11-06, 2d\nB :b, after a, 1d');expect(m.diagnostics).toEqual([]);expect(new Date(m.nodes[0].gantt!.end).getDate()).toBe(10);expect(m.gantt!.excluded.length).toBeGreaterThan(0);
 const inc=await parse('inclusiveEndDates\nA :a, 2026-11-02, 2026-11-03');expect(inc.diagnostics).toEqual([]);expect(new Date(inc.nodes[0].gantt!.end).getDate()).toBe(4);
});
it('draws until as a distinct dependency and implicit sequential tasks',async()=>{
 const m=await parse('A :a, 2026-11-02, 2d\nB :2d\nC :c, 2026-11-01, until a');expect(m.diagnostics).toEqual([]);expect(m.nodes[1].gantt!.start).toBe(m.nodes[0].gantt!.end);expect(m.nodes[2].gantt!.end).toBe(m.nodes[0].gantt!.start);expect(m.edges.some(e=>e.label==='until')).toBe(true);
});
it.each(['A :a, after missing, 2d','A :a, after b, 1d\nB :b, after a, 1d','A :a, 2026-11-02, 1d\nB :a, 2026-11-04, 1d','A :a, 2026-11-04, 2026-11-02'])('rejects invalid references/cycles/IDs/dates: %s',async source=>{const m=await parse(source);expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);});
it('renders sub-day tasks and custom date formats',async()=>{
 const m=await parseDiagram('gantt\n dateFormat YYYY-MM-DD HH:mm\n axisFormat %H:%M\n tickInterval 1hour\n A :a, 2026-11-02 09:00, 2h\n B :b, after a, 30m');expect(m.diagnostics).toEqual([]);expect(m.nodes[1].gantt!.end-m.nodes[1].gantt!.start).toBe(1800000);expect(renderDiagram(m).svg).toContain('09:00');
});
it('supports standard theme colors and optional per-task ArchMap color',async()=>{
 const m=await parseDiagram('---\nconfig:\n  theme: base\n  themeVariables:\n    taskBkgColor: "#346ab2"\n    critBkgColor: "#a13366"\n---\n%% archmap: {"nodes":{"b":{"color":"green"}}}\ngantt\nA :a, 2026-11-02, 2d\nB :b, after a, 1d\nC :crit, c, after b, 1d');expect(m.diagnostics).toEqual([]);const svg=renderDiagram(m).svg;expect(svg).toContain('fill="#346ab2"');expect(svg).toContain('fill="#a13366"');expect(svg).toContain('fill="#247954"');
});
it('rejects unsafe theme paint and click behavior',async()=>{
 const m=await parseDiagram('---\nconfig:\n  themeVariables:\n    taskBkgColor: "url(https://evil.example)"\n---\ngantt\nA :a, 2026-11-02, 1d');expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
 const click=await parse('A :a, 2026-11-02, 1d\nclick a href "https://example.com"');expect(click.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('keeps long Japanese task names in their own measured rows and routes without hitting unrelated bars',async()=>{
 const source=Array.from({length:25},(_,i)=>`${'長い日本語のタスク名を確認する'.repeat(i%3+1)} :t${i}, ${i>1?'after t'+(i-2):'2026-11-02'}, ${i%5+1}d`).join('\n');const m=await parse(source);expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);
 for(const n of r.layout.nodes){expect(n.x+n.width).toBeLessThan(r.layout.width);expect(n.y+n.height).toBeLessThan(r.layout.height);}
 for(const e of r.layout.edges)for(let i=1;i<e.points.length;i++)for(const n of r.layout.nodes){if(n.node.id===e.edge.from||n.node.id===e.edge.to)continue;expect(segmentIntersectsBox(e.points[i-1],e.points[i],n)).toBe(false);}
});
it('handles a single zero-length milestone and dense tick requests',async()=>{
 const m=await parse('tickInterval 1millisecond\nA :milestone, a, 2026-11-02, 0d');expect(m.diagnostics).toEqual([]);expect(renderDiagram(m).svg).not.toMatch(/NaN|Infinity/);
});
it('escapes labels and leaves the source model unchanged',async()=>{
 const m=await parse('A <script> :a, 2026-11-02, 2d');expect(m.diagnostics).toEqual([]);const before=JSON.stringify(m);const r=renderDiagram(m);expect(r.svg).not.toContain('<script>');expect(JSON.stringify(m)).toBe(before);
});
it('prevents a timeline grid or manual positions from changing calendar semantics',async()=>{
 const m=await parseDiagram('%% archmap: {"nodes":{"a":{"at":[2,2]}}}\ngantt\nA :a, 2026-11-02, 1d');expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});

it('handles forward references, repeated sections and a multi-day milestone',async()=>{
 const m=await parse('section A\nLater :later, after early, 2d\nsection B\nEarlier :early, 2026-11-02, 1d\nsection A\nFinish :milestone, finish, after later, 2d');expect(m.diagnostics).toEqual([]);expect(m.nodes[0].gantt!.start).toBe(m.nodes[1].gantt!.end);const r=renderDiagram(m);expect(r.layout.groups).toHaveLength(3);expect(r.svg).not.toMatch(/NaN|Infinity/);
});
it('retains no-dependency parallel tasks and vertical date markers',async()=>{
 const m=await parse('A :a, 2026-11-02, 2d\nB :b, 2026-11-03, 2d\nDeadline :vert, limit, 2026-11-04, 0d');expect(m.diagnostics).toEqual([]);expect(m.edges).toEqual([]);expect(m.nodes[2].gantt!.vertical).toBe(true);expect(renderDiagram(m).svg).toContain('stroke-dasharray="5 4"');
});
it('honors Friday weekends and included dates',async()=>{
 const m=await parse('weekend friday\nexcludes weekends\nincludes 2026-11-06\nA :a, 2026-11-05, 3d');expect(m.diagnostics).toEqual([]);expect(m.gantt!.excluded).toHaveLength(1);expect(new Date(m.gantt!.excluded[0][0]).getDay()).toBe(6);
});
it('scales a five-minute plan to the time axis rather than a one-hour minimum',async()=>{
 const m=await parseDiagram('gantt\n dateFormat YYYY-MM-DD HH:mm\n axisFormat %H:%M\n tickInterval 1minute\nA :a, 2026-11-11 09:00, 2m\nB :b, after a, 3m');expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.layout.nodes[0].width).toBeGreaterThan(350);expect(r.svg).toContain('09:02');
});
it('adds custom and derived columns without changing dates or dependencies',async()=>{
 const body='gantt\n dateFormat YYYY-MM-DD HH:mm\nA :active, a, 2026-11-11 09:00, 15m\nB :b, after a, 30m';
 const plain=await parseDiagram(body),meta={gantt:{columns:[{key:'owner',label:'担当',width:120},{key:'duration',label:'経過時間',width:100},{key:'status',label:'状態',width:100}],rows:{a:{owner:'運用チーム'},b:{owner:'開発チーム'}}}};
 const m=await parseDiagram('%% archmap: '+JSON.stringify(meta)+'\n'+body);expect(m.diagnostics).toEqual([]);expect(m.edges).toEqual(plain.edges);expect(m.nodes).toEqual(plain.nodes);const r=renderDiagram(m);expect(r.layout.width).toBe(renderDiagram(plain).layout.width+320);expect(r.svg).toContain('運用チーム');expect(r.svg).toContain('15分');expect(r.svg).toContain('data-column="status"');
});
it('measures long headers and cells and escapes text',async()=>{
 const meta={gantt:{columns:[{key:'memo',label:'長い見出しを折り返して表示する',width:100}],rows:{a:{memo:'引継ぎ事項を確認する'.repeat(8)+'<script>'}}}};
 const m=await parseDiagram('%% archmap: '+JSON.stringify(meta)+'\ngantt\nA :a, 2026-11-11, 1d\nB :b, after a, 1d');expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.layout.nodes[1].y-r.layout.nodes[0].y).toBeGreaterThan(200);expect(r.svg).not.toContain('<script>');expect(r.svg).toContain('—');
});
it.each([
 {columns:[{key:'owner',label:'担当',width:12}]},
 {columns:[{key:'owner',label:'担当'},{key:'owner',label:'重複'}]},
 {columns:[{key:'owner',label:'担当'}],rows:{missing:{owner:'X'}}},
 {columns:[{key:'start',label:'開始'}],rows:{a:{start:'変える'}}},
 {columns:[{key:'owner',label:'担当'}],rows:{a:{unknown:'X'}}},
 {columns:[{key:'constructor',label:'不正'}]},
])('rejects invalid columns %j',async gantt=>{const m=await parseDiagram('%% archmap: '+JSON.stringify({gantt})+'\ngantt\nA :a, 2026-11-11, 1d');expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);});
it('does not lose time-of-day on a multi-day plan',async()=>{
 const m=await parseDiagram('gantt\ndateFormat YYYY-MM-DD HH:mm\nA :a, 2026-11-11 09:15, 7d');expect(m.diagnostics).toEqual([]);expect(renderDiagram(m).svg).toContain('09:15');
});
