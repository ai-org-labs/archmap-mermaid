import {expect,it} from 'vitest';
import {readArchmapMetadata,updateArchmapMetadata} from '../src/focused/metadata.js';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
const block='%% archmap: {\n%%   "view": "overview",\n%%   "nodes": {"A":{"attention":"focus","callout":"brace } and quote \\" works"}}\n%% }';
it('parses multiline JSON and preserves line numbers and following comments',()=>{
 const s=block+'\n%% normal comment\nflowchart LR\nA --> B',r=readArchmapMetadata(s);
 expect(r.metadata.view).toBe('overview');expect(r.end).toBe(3);
 expect(r.mermaidSource.split('\n')[4]).toBe('%% normal comment');
});
it('keeps legacy and multiline parsed models equivalent',async()=>{
 const meta=readArchmapMetadata(block).metadata;
 const a=await parseDiagram(block+'\nflowchart LR\nA --> B');
 const b=await parseDiagram('%% archmap: '+JSON.stringify(meta)+'\nflowchart LR\nA --> B');
 expect(a.diagnostics).toEqual([]);expect(a).toEqual(b);
});
it.each([true,false])('renders title with metadata before frontmatter=%s',async before=>{
 const front='---\ntitle: システム概要\n---';
 const m=await parseDiagram((before?block+'\n'+front:front+'\n'+block)+'\nflowchart LR\nA --> B');
 expect(m.diagnostics).toEqual([]);expect(m.title).toBe('システム概要');
 const svg=new DOMParser().parseFromString(renderDiagram(m).svg,'image/svg+xml');
 expect([...svg.querySelectorAll('text')].some(t=>t.textContent==='システム概要')).toBe(true);
});
it('reserves space for long and multiline titles',async()=>{
 const title='システム概要と重要な通信経路'.repeat(12);
 const m=await parseDiagram('---\ntitle: |\n  '+title+'\n  第二行\n---\n'+block+'\nflowchart LR\nA --> B');
 const r=renderDiagram(m);expect(m.title).toContain('第二行');
 expect(Math.min(...r.layout.nodes.map(n=>n.y))).toBeGreaterThan(150);expect(r.svg).toContain('第二行');
});
it('updates toolbar style without duplicate block or losing other settings',()=>{
 const s='---\ntitle: Test\n---\n'+block+'\nflowchart LR\nA --> B';
 const changed=updateArchmapMetadata(s,{style:'icons'}),r=readArchmapMetadata(changed);
 expect(r.metadata.style).toBe('icons');expect(r.metadata.nodes).toEqual(readArchmapMetadata(s).metadata.nodes);
 expect(changed.match(/%% archmap:/g)).toHaveLength(1);expect(changed).toContain('\n%% ');
 expect(changed.startsWith('---\ntitle: Test\n---')).toBe(true);
});
it('inserts metadata after frontmatter when absent',()=>{
 const s='---\ntitle: Test\n---\nflowchart LR\nA';
 expect(updateArchmapMetadata(s,{style:'icons'})).toContain('---\n%% archmap: {"style":"icons"}\nflowchart');
});
it.each([
 '%% archmap: {\n "view":"overview"\n%% }',
 '%% archmap: {\n%% "view":"overview",\n%% }',
 '%% archmap: {}\n%% archmap: {}',
 '%% archmap: {"view":"overview"',
 '%% archmap: []',
])('rejects malformed or duplicate metadata',async source=>{
 const m=await parseDiagram(source+'\nflowchart LR\nA');expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('supports CRLF and closes before ordinary comments',()=>{
 const r=readArchmapMetadata((block+'\n%% ordinary').replace(/\n/g,'\r\n'));expect(r.metadata.view).toBe('overview');expect(r.mermaidSource).toContain('%% ordinary');
});
