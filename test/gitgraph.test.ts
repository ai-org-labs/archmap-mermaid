import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {computeDiagramLayout} from '../src/focused/layout.js';
const history='commit id:"init"\nbranch feature\ncommit id:"work" type:HIGHLIGHT\ncheckout main\ncommit id:"fix" type:REVERSE\nmerge feature id:"release" tag:"v1.0"';
it('preserves branch order, both merge parents, tags and commit types',async()=>{
 const m=await parseDiagram('gitGraph\n'+history);expect(m.diagnostics).toEqual([]);expect(m.kind).toBe('gitgraph');expect(m.gitgraph!.branches).toEqual(['main','feature']);expect(m.nodes[3].git!.parents).toEqual(['fix','work']);expect(m.nodes[1].git!.type).toBe(2);expect(m.edges).toHaveLength(4);
 const r=renderDiagram(m);expect(r.svg).toContain('v1.0');expect(r.svg).not.toMatch(/NaN|undefined|Infinity/);expect(new DOMParser().parseFromString(r.svg,'image/svg+xml').querySelector('parsererror')).toBeNull();expect(computeDiagramLayout(m)).toEqual(r.layout);
});
it.each(['LR','TB','BT'])('preserves chronological direction %s',async dir=>{
 const m=await parseDiagram(`gitGraph ${dir}:\n${history}`);expect(m.diagnostics).toEqual([]);const r=renderDiagram(m),[a,b]=r.layout.nodes;
 if(dir==='LR')expect(b.x).toBeGreaterThan(a.x);else if(dir==='TB')expect(b.y).toBeGreaterThan(a.y);else expect(b.y).toBeLessThan(a.y);
 for(const n of r.layout.nodes){expect(n.x).toBeGreaterThan(0);expect(n.y).toBeGreaterThan(0);expect(n.x+n.width).toBeLessThan(r.layout.width);expect(n.y+n.height).toBeLessThan(r.layout.height);}
});
it('distinguishes cherry-pick origin from actual parent history',async()=>{
 const m=await parseDiagram('gitGraph\ncommit id:"a"\nbranch dev\ncommit id:"b"\ncheckout main\ncommit id:"c"\ncherry-pick id:"b" tag:"hotfix"');expect(m.diagnostics).toEqual([]);expect(m.nodes[m.nodes.length-1].git!.type).toBe(4);expect(m.edges[m.edges.length-1].label).toBe('cherry-pick');expect(m.edges[m.edges.length-1].style).toBe('dashed');expect(renderDiagram(m).svg).toContain('hotfix');
});
it('supports named main branch, branch order, switches, label visibility and parallel depth',async()=>{
 const m=await parseDiagram('---\nconfig:\n  gitGraph:\n    mainBranchName: trunk\n    mainBranchOrder: 3\n    parallelCommits: true\n    showCommitLabel: false\n    showBranches: false\n  themeVariables:\n    git0: "#123456"\n---\ngitGraph\ncommit id:"a"\nbranch dev order:1\ncommit id:"b"\nswitch trunk\ncommit id:"c"');expect(m.diagnostics).toEqual([]);expect(m.gitgraph!.branches).toEqual(['dev','trunk']);const r=renderDiagram(m);expect(r.layout.nodes[1].x).toBe(r.layout.nodes[2].x);expect(r.svg).toContain('#123456');expect(r.svg).not.toContain('>trunk</text>');expect(r.svg).not.toContain('>a</text>');
 const next=await parseDiagram('gitGraph\ncommit id:"a"');expect(next.gitgraph!.branches).toEqual(['main']);
});
it.each(['commit id:"a"\ncommit id:"a"','commit\ncheckout missing','commit\nmerge missing','commit\ncherry-pick id:"missing"','commit\nbranch dev\nbranch dev'])('reports invalid history: %s',async body=>{expect((await parseDiagram('gitGraph\n'+body)).diagnostics.some(d=>d.severity==='error')).toBe(true);});
it('rejects unsafe color and incompatible layout metadata',async()=>{
 for(const prefix of ['---\nconfig:\n  themeVariables:\n    git0: "url(https://evil.example)"\n---\n','%% archmap: {"grid":{"columns":2,"items":[]}}\n','%% archmap: {"view":"system"}\n'])expect((await parseDiagram(prefix+'gitGraph\ncommit')).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('wraps long Japanese labels and tags without truncation and creates valid SVG',async()=>{
 const id='長いコミット名を省略せずに表示する'.repeat(5),tag='長いリリースタグ'.repeat(5);
 const m=await parseDiagram(`gitGraph\ncommit id:"${id}" tag:"${tag}"\ncommit id:"next"`);expect(m.diagnostics).toEqual([]);const r=renderDiagram(m);expect(r.layout.height).toBeGreaterThan(300);expect(r.svg).toContain(id);expect(r.svg).toContain(tag);expect(new DOMParser().parseFromString(r.svg,'image/svg+xml').querySelector('parsererror')).toBeNull();
});
it.each(['LR','TB','BT'])('avoids unrelated commit symbols on an older cherry-pick origin (%s)',async dir=>{
 const m=await parseDiagram(`gitGraph ${dir}:\ncommit id:"a"\nbranch dev\ncommit id:"b"\ncommit id:"d"\ncheckout main\ncommit id:"c"\ncommit id:"e"\ncherry-pick id:"b"`);expect(m.diagnostics).toEqual([]);
 const {segmentIntersectsBox}=await import('../src/focused/layout.js');const r=renderDiagram(m);
 for(const edge of r.layout.edges)for(let i=1;i<edge.points.length;i++)for(const n of r.layout.nodes)if(n.node.id!==edge.edge.from&&n.node.id!==edge.edge.to)expect(segmentIntersectsBox(edge.points[i-1],edge.points[i],n,0)).toBe(false);
});
it('accepts cherry-pick of a merge with an explicit parent',async()=>{
 const m=await parseDiagram('gitGraph\n'+history+'\ncheckout feature\ncommit id:"more"\ncherry-pick id:"release" parent:"work"');expect(m.diagnostics).toEqual([]);expect(m.nodes[m.nodes.length-1].git!.type).toBe(4);
});
it('escapes text and rejects malformed config without leaking parser state',async()=>{
 const bad=await parseDiagram('---\nconfig:\n  gitGraph:\n    showBranches: "yes"\n---\ngitGraph\ncommit');expect(bad.diagnostics.some(d=>d.severity==='error')).toBe(true);
 const m=await parseDiagram('---\ntitle: "<script>bad</script>"\n---\ngitGraph\ncommit id:"a&b"');const svg=renderDiagram(m).svg;expect(svg).not.toContain('<script>');expect(new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('parsererror')).toBeNull();
});
it('fits a long title even with a single commit',async()=>{
 const m=await parseDiagram('---\ntitle: '+ '長い図のタイトル'.repeat(12)+'\n---\ngitGraph\ncommit id:"one"');
 const {textWidth,wrapText}=await import('../src/focused/layout.js');const r=renderDiagram(m);
 for(const line of wrapText(m.title,900,24))expect(textWidth(line,24)+56).toBeLessThanOrEqual(r.layout.width);
});
