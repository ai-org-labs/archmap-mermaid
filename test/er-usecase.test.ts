import {beforeAll,expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {DIAGRAM_SAMPLES} from '../src/focused/samples.js';
import {boxesOverlap,segmentIntersectsBox} from '../src/focused/layout.js';
beforeAll(installDiagramIcons);
it('preserves ER keys, nullable types, comments and cardinality orientation',async()=>{
 const m=await parseDiagram('erDiagram\n direction LR\n A[顧客] {\n uuid id PK, FK "キー"\n string? name\n }\n A ||..o{ B : owns');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 expect(m.nodes[0].attributes?.[0]).toMatchObject({keys:['PK','FK'],comment:'キー'});
 expect(m.edges[0]).toMatchObject({sourceMarker:'one',targetMarker:'zero-many',style:'dashed'});
 expect(renderDiagram(m).svg).toContain('marker-start="url(#archmap-one)"');
});
it('preserves usecase semantics and direction',async()=>{
 const m=await parseDiagram('usecase-beta\n actor User\n actor Admin\n Admin --|> User\n A(注文)\n B(支払)\n C(追加)\n User -- A\n A ..> : include B\n C ..> : extend A');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 expect(m.edges[0]).toMatchObject({from:'Admin',to:'User',targetMarker:'generalization'});
 expect(m.edges[2]).toMatchObject({from:'A',to:'B',label:'«include»',style:'dashed',arrow:'open'});
 expect(m.edges[3]).toMatchObject({from:'C',to:'A',label:'«extend»'});
});
it.each(DIAGRAM_SAMPLES.filter(s=>['er','usecase'].includes(s.id)))('renders $id preview',async s=>{
 const m=await parseDiagram(s.source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const r=renderDiagram(m);expect(r.svg).not.toMatch(/NaN|Infinity/);expect(r.layout.edges).toHaveLength(m.edges.length);
 for(const e of r.layout.edges)for(let i=1;i<e.points.length;i++)for(const n of r.layout.nodes) {
  if(n.node.id===e.edge.from&&i===1||n.node.id===e.edge.to&&i===e.points.length-1)continue;
  expect(segmentIntersectsBox(e.points[i-1]!,e.points[i]!,n,-1)).toBe(false);
 }
 for(const e of r.layout.edges)if(e.labelBox)for(const n of r.layout.nodes)expect(boxesOverlap(e.labelBox,n)).toBe(false);
});
it.each([
 ['||--||','one','one'],['|o--o|','zero-one','zero-one'],['}|--|{','many','many'],['}o--o{','zero-many','zero-many'],
])('preserves both cardinalities %s',async(op,left,right)=>{
 const m=await parseDiagram(`erDiagram\n A ${op} B : relates`);
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 expect(m.edges[0]).toMatchObject({from:'A',to:'B',sourceMarker:left,targetMarker:right});
});
it('preserves stable ER names for manual placement and standalone entities',async()=>{
 const m=await parseDiagram('%% archmap: {"nodes":{"A":{"at":[2,1]}}}\nerDiagram\n A[顧客]\n B');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 expect(m.nodes[0]).toMatchObject({id:'A',at:[2,1],label:'顧客',attributes:[]});
 expect(renderDiagram(m).layout.nodes).toHaveLength(2);
});
it('does not execute labels and keeps long attributes inside rows',async()=>{
 const m=await parseDiagram('erDiagram\n A {\n string very_long_attribute_name_for_readable_wrapping "<script>alert(1)</script>"\n }');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const r=renderDiagram(m);expect(r.svg).not.toContain('<script>');expect(r.svg).toContain('&lt;script&gt;');
 expect(r.layout.nodes[0].height).toBeGreaterThan(100);
});
it.each(['LR','TB'])('keeps usecase boundary around its members in %s',async dir=>{
 const m=await parseDiagram(`usecase-beta\n direction ${dir}\n actor User\n systemBoundary App[アプリ]\n A(注文)\n B(決済)\n end\n User -- A\n A ..> : include B`);
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const l=renderDiagram(m).layout,g=l.groups[0];
 for(const n of l.nodes.filter(n=>n.node.group==='App'))expect(n.x>=g.x&&n.y>=g.y&&n.x+n.width<=g.x+g.width&&n.y+n.height<=g.y+g.height).toBe(true);
});

it('separates multiple system boundaries',async()=>{
 const m=await parseDiagram('usecase-beta\n actor U\n systemBoundary A\n A1(操作1)\n A2(操作2)\n end\n systemBoundary B\n B1(操作3)\n B2(操作4)\n end\n U -- A1\n U -- A2\n U -- B1\n B1 ..> : include B2');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const l=renderDiagram(m).layout;expect(boxesOverlap(l.groups[0],l.groups[1])).toBe(false);
});

it('keeps an external actor outside a boundary containing another actor',async()=>{
 const m=await parseDiagram('usecase-beta\n direction LR\n actor Outside\n systemBoundary App\n actor Inside\n A(操作)\n end\n Outside -- A\n Inside -- A');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const l=renderDiagram(m).layout;expect(boxesOverlap(l.groups[0],l.nodes.find(n=>n.node.id==='Outside')!)).toBe(false);
});
it.each(['LR','TB'])('separates manual and automatic boundaries in %s',async direction=>{
 const m=await parseDiagram(`%% archmap: {"nodes":{"A1":{"at":[2,8]}}}\nusecase-beta\ndirection ${direction}\nsystemBoundary A\n A1(One)\n A2(Two)\nend\nsystemBoundary B\n B1(Three)\nend`);
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const l=renderDiagram(m).layout;expect(boxesOverlap(l.groups[0],l.groups[1])).toBe(false);
});
it('renders empty boundaries without adding semantic nodes',async()=>{
 const m=await parseDiagram('usecase-beta\nsystemBoundary Empty[準備中]\nend\nactor User');
 const r=renderDiagram(m);expect(r.layout.groups.map(g=>g.group.id)).toEqual(['Empty']);
 expect(r.layout.nodes).toHaveLength(m.nodes.length);expect(r.svg).toContain('準備中');expect(m.nodes).toHaveLength(1);
});
it('reserves straight space for cardinality markers on self relations',async()=>{
 const m=await parseDiagram('erDiagram\n EMPLOYEE }o--o| EMPLOYEE : manager');
 const e=renderDiagram(m).layout.edges[0],p=e.points;
 const length=(a:typeof p[0],b:typeof p[0])=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 expect(length(p[0],p[1])).toBeGreaterThanOrEqual(28);expect(length(p[p.length-1]!,p[p.length-2]!)).toBeGreaterThanOrEqual(28);
});
it('renders notes as wrapped annotations attached to their target',async()=>{
 const m=await parseDiagram('usecase-beta\nactor User\nsystemBoundary App\n A(注文)\nend\nUser -- A\nnote for A "決済が完了してから注文を確定する。長い説明も省略せずに折り返して表示する。"\nnote for User "<script>not executable</script>"');
 expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const notes=m.nodes.filter(n=>n.shape==='note');expect(notes).toHaveLength(2);
 expect(notes[0].group).toBe('App');expect(m.edges.find(e=>e.to===notes[0].id)).toMatchObject({from:'A',style:'dashed',arrow:'none'});
 const r=renderDiagram(m);expect(r.svg).not.toContain('<script>');expect(r.svg).toContain('決済');
 for(const e of r.layout.edges)for(let i=1;i<e.points.length;i++)for(const n of r.layout.nodes){
 if(n.node.id===e.edge.from&&i===1||n.node.id===e.edge.to&&i===e.points.length-1)continue;
 expect(segmentIntersectsBox(e.points[i-1],e.points[i],n,-1)).toBe(false);
 }
});
