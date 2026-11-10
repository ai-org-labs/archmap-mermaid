import {expect,it} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {overviewContent} from '../src/focused/layout.js';
const parse=(fontFamily:unknown,attention='focus')=>parseDiagram('%% archmap: '+JSON.stringify({view:'overview',nodes:{A:{attention,fontFamily,callout:'重要な処理の説明'}}})+'\nflowchart LR\nA[Important processing boundary] --> B[Context]');
it.each(['sans','serif','mono'])('applies %s to focus headings only',async font=>{
 const m=await parse(font),before=JSON.stringify(m),r=renderDiagram(m);
 expect(m.diagnostics).toEqual([]);expect(JSON.stringify(m)).toBe(before);
 const a=r.svg.split('data-node="A"')[1].split('data-node="B"')[0],b=r.svg.split('data-node="B"')[1];
 expect(a.match(/<g font-family=/g)).toHaveLength(2);expect(b).not.toContain('<g font-family=');
});
it('restores common font for context while preserving the setting',async()=>{
 const m=await parse('serif','context');expect(renderDiagram(m).svg).not.toContain('<g font-family=');
 expect(m.nodes[0].fontFamily).toBe('serif');
});
it('accounts for wider fonts without shrinking text',async()=>{
 const sans=await parse('sans'),mono=await parse('mono');
 const a=overviewContent(sans.nodes[0]),b=overviewContent(mono.nodes[0]);
 expect(b.titleSize).toBe(a.titleSize);expect(b.title.length).toBeGreaterThanOrEqual(a.title.length);
 expect(b.height).toBeGreaterThanOrEqual(a.height);
});
it('rejects arbitrary font strings',async()=>{
 const m=await parse('url(https://example.com/font)');expect(m.diagnostics.some(d=>d.severity==='error')).toBe(true);
});
