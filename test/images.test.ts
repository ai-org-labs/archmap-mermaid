import {describe,it,expect} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {imageSize,validImageSource} from '../src/focused/images.js';
describe('standard Mermaid image nodes',()=>{
 it.each(['system','screens'])('preserves standard properties in %s',async view=>{
  const m=await parseDiagram(`%% archmap: {"view":"${view}"}\nflowchart LR\n A@{img: "https://example.com/screen.png",label: "ホーム",w: 180,h: 240,pos: "t",constraint: "on"}\n A -->|選択| B[詳細]`);
  expect(m.diagnostics).toEqual([]);expect(m.nodes[0].image).toMatchObject({width: 180,height:240,position:'t',constraint: 'on'});
  m.nodes[0].image!.naturalWidth=300;m.nodes[0].image!.naturalHeight=600;
  expect(imageSize(m.nodes[0])).toEqual({width: 120,height:240});
  const r=renderDiagram(m);expect(r.svg).toContain('<image');expect(r.svg).not.toMatch(/NaN|Infinity/);
  if(view==='screens'){const n=r.layout.nodes[0];expect(n.screen?.image?.height).toBe(240);expect(n.screen!.actions[0].top).toBeGreaterThan(n.screen!.image!.y+240);}
 });
 it('rejects non-image and executable sources',()=>{
  for(const src of ['javascript:alert(1)','data:text/html,<img>','ftp://example.com/a.png'])expect(validImageSource(src)).toBe(false);
  expect(validImageSource('https://example.com/a.png')).toBe(true);
 });
 it('keeps dimensions independent with constraint off and marks load failures',async()=>{
  const m=await parseDiagram('flowchart LR\n A@{img: "https://example.com/a.png",w: 180,h: 240,constraint: "off"}');
  expect(m.diagnostics).toEqual([]);expect(imageSize(m.nodes[0])).toEqual({width: 180,height:240});
  m.nodes[0].image!.error=true;expect(renderDiagram(m).svg).toContain('画像を読み込めません');
 });
});
