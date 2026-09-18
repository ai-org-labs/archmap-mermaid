import {describe,it,expect,beforeAll} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {DIAGRAM_SAMPLES} from '../src/focused/samples.js';
beforeAll(installDiagramIcons);
describe('official Mermaid input → ArchMap renderer',()=>{
  it.each(DIAGRAM_SAMPLES)('renders $id sample',async sample=>{
    const model=await parseDiagram(sample.source);
    expect(model.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
    expect(model.kind).toBe(sample.id);
    const rendered=renderDiagram(model);
    expect(rendered.svg).toContain('<svg');expect(rendered.svg).not.toMatch(/NaN|Infinity/);
    expect(rendered.layout.nodes.length).toBe(model.nodes.length);
  });
  it('preserves nested groups, edges and arrows',async()=>{
    const m=await parseDiagram('flowchart LR\nsubgraph outer[Cloud]\nsubgraph inner[App]\nA[Web] -->|request| B[(Data)]\nend\nC[Queue]\nend\nB -.-> C\nA --- C\nA <--> B');
    expect(m.diagnostics).toEqual([]);expect(m.groups.find(g=>g.id==='inner')?.parent).toBe('outer');
    expect(m.nodes.find(n=>n.id==='A')?.group).toBe('inner');
    expect(m.edges.map(e=>[e.style,e.bidirectional,e.arrow])).toEqual([['solid',false,'open'],['dashed',false,'open'],['solid',false,'none'],['solid',true,'open']]);
  });
  it('keeps activation events and nested fragment order',async()=>{
    const m=await parseDiagram(DIAGRAM_SAMPLES[2].source);
    expect(m.activationEvents?.map(e=>e.action)).toEqual(['activate','activate','deactivate','deactivate']);
    expect(m.fragmentEvents?.map(e=>e.action)).toEqual(['alt','par','and','end','else','end']);
    const l=renderDiagram(m).layout;expect(l.activations).toHaveLength(2);expect(l.fragments).toHaveLength(2);
  });
  it('supports modal, state and local actions',async()=>{
    const m=await parseDiagram(DIAGRAM_SAMPLES[3].source);expect(m.nodes.find(n=>n.id==='confirm')?.shape).toBe('modal');
    const r=renderDiagram(m);expect(r.svg).toContain('data-action-kind="state"');expect(r.svg).toContain('data-action-kind="close"');
  });
  it('does not mix concurrent diagram databases',async()=>{
    const models=await Promise.all(DIAGRAM_SAMPLES.map(s=>parseDiagram(s.source)));
    expect(models.map(m=>m.kind)).toEqual(DIAGRAM_SAMPLES.map(s=>s.id));
    expect(models[0].nodes.some(n=>n.id==='api')).toBe(true);expect(models[1].nodes.some(n=>n.id==='api')).toBe(false);
  });
  it.each(['classDiagram\nA --> B','architecture-beta\nservice A(cloud)[A]','flowchart RL\nA-->B','flowchart LR\nA-->G\nsubgraph G\nB\nend','sequenceDiagram\nA->>B: Hi\nNote over A: hello','stateDiagram-v2\nA-->B\nnote right of A: hello','flowchart LR\nA@{img: "https://example.com/a.png"}'])('reports unsupported syntax: %s',async source=>{
    expect((await parseDiagram(source)).diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('escapes untrusted labels and rejects bad metadata',async()=>{
    const m=await parseDiagram('flowchart LR\nA["<script>alert(1)</script>"] --> B[Safe]');
    expect(renderDiagram(m).svg).not.toContain('<script>');
    for(const meta of ['{"nodes":{"missing":{"icon":"user"}}}','{"nodes":{"A":{"at":[0,1]}}}','{"unknown":true}','{"nodes":{"A":{"icon":"bogus"}}}'])expect((await parseDiagram(`%% archmap: ${meta}\nflowchart LR\nA-->B`)).diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('renders a plain Mermaid graph without custom metadata',async()=>{
    const m=await parseDiagram('graph TB\nA[Start] --> B{OK?}\nB -->|yes| C[Done]');expect(m.diagnostics).toEqual([]);expect(renderDiagram(m).layout.edges).toHaveLength(2);
  });
});

it('accepts 400 nodes / 200 nested containers and rejects node 401', async()=>{
  installDiagramIcons();
  const source=['flowchart LR',...Array.from({length:200},(_,i)=>`subgraph g${i}[Group ${i}]\na${i}[A ${i}] --> b${i}[B ${i}]\nend`)].join('\n');
  const m=await parseDiagram(source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
  expect(m.nodes).toHaveLength(400);expect(m.groups).toHaveLength(200);
  expect(renderDiagram(m).svg).not.toMatch(/NaN|Infinity/);
  expect((await parseDiagram(source+'\nextra[Extra]')).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('supports 1000 edges and rejects the next edge',async()=>{
  const source='flowchart LR\n'+('A-->B\n'.repeat(1000));
  expect((await parseDiagram(source)).edges).toHaveLength(1000);
  expect((await parseDiagram(source+'A-->B')).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('rejects click callbacks and unclosed activations',async()=>{
  for(const source of ['flowchart LR\nA-->B\nclick A callback','sequenceDiagram\nA->>+B: call'])expect((await parseDiagram(source)).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
