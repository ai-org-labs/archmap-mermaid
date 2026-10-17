import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=process.cwd();
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'archmap-plugin-test-'));
const plugin=path.join(temp,'plugin with spaces');
await fs.cp(path.join(root,'plugin-dist/plugins/archmap-mermaid'),plugin,{recursive:true});
const run=(args,ok=true)=>{const r=spawnSync(process.execPath,[path.join(plugin,'runtime/cli.mjs'),...args],{cwd:temp,encoding:'utf8',timeout:70000});assert.equal(r.status===0,ok,r.stderr||r.error?.message);return ok?JSON.parse(r.stdout):r.stderr;};
const setup=spawnSync(process.execPath,[path.join(plugin,'runtime/setup.mjs')],{cwd:temp,stdio:'inherit',timeout:180000});assert.equal(setup.status,0);
assert.equal(run(['doctor']).chromium,false);
assert(run(['icons','server']).some(i=>i.key==='server'));
const js=ts.transpileModule(await fs.readFile('src/focused/samples.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {DIAGRAM_SAMPLES}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const sample of DIAGRAM_SAMPLES){
 const file=path.join(temp,sample.id+'.mmd'),base=path.join(temp,'outputs',sample.id);
 await fs.writeFile(file,sample.source);
 const result=run(['render',file,'--out',base,'--png']);
 assert(result.nodes>0);assert(result.edges>0);assert(!result.diagnostics.some(d=>d.severity==='error'));
 const png=await fs.readFile(base+'.png');assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),result.pngWidth);assert.equal(png.readUInt32BE(20),result.pngHeight);
 assert((await fs.readFile(base+'.svg','utf8')).includes('<svg'));
 assert((await fs.readFile(base+'.html','utf8')).includes('Content-Security-Policy'));
 if(sample.id==='system'){
  const original=await fs.readFile(base+'.svg','utf8');
  assert.match(run(['render',file,'--out',base],false),/Output exists/);
  await fs.writeFile(file,'flowchart LR\nA[Broken');
  run(['render',file,'--out',base,'--force'],false);
  assert.equal(await fs.readFile(base+'.svg','utf8'),original);
  await fs.writeFile(file,'flowchart LR\nA[Updated] --> B[Done]');
  assert.equal(run(['render',file,'--out',base,'--force']).nodes,2);
 }
 console.log('PASS '+sample.id);
}
const external=path.join(temp,'external.mmd');await fs.writeFile(external,'flowchart LR\nA@{ img: "https://example.com/private.png", label: "Image" }');
assert.match(run(['render',external,'--out',path.join(temp,'external')],false),/External images/);
console.log('PASS invalid source, no overwrite, update, offline image policy, paths with spaces');
console.log('Artifacts: '+temp);

const runtime=await import(new URL('file://'+path.join(plugin,'runtime/node-render.mjs')));
const catalog=run(['icons']);
for(const key of ['aws/lambda','gcp/cloud_run','github'])assert(catalog.some(i=>i.key===key),'Missing bundled icon '+key);
const iconSource='flowchart LR\nA@{ icon: "aws:lambda", label: "Lambda" } --> B@{ icon: "gcp:cloud_run", label: "Cloud Run" }';
const iconFile=path.join(temp,'icons.mmd'),iconBase=path.join(temp,'outputs/icons');await fs.writeFile(iconFile,iconSource);
assert.equal(run(['render',iconFile,'--out',iconBase,'--png']).nodes,2);
const iconSvg=await fs.readFile(iconBase+'.svg','utf8');assert.match(iconSvg,/<svg[^>]+viewBox/);assert(!iconSvg.includes('<image'));
const badIcon=path.join(temp,'bad-icon.mmd');await fs.writeFile(badIcon,'flowchart LR\nA@{ icon: "aws:missing-service", label: "Missing" }');
assert.match(run(['render',badIcon,'--out',path.join(temp,'bad-icon')],false),/未登録アイコン/);
for(const [direction,start,end] of [['LR',180,0],['RL',360,180],['TD',270,90],['BT',90,-90]]){
 const result=await runtime.render(`flowchart ${direction}\nA[Source] <--> B[Target]`);
 const d=new DOMParser().parseFromString(runtime.pngSvg(result.svg,result.layout),'image/svg+xml');
 for(const [side,angle] of [['start',start],['end',end]])assert.equal(Number(d.getElementById('png-marker-0-'+side).getAttribute('orient')),angle);
}
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbasAAAAASUVORK5CYII=';
const imageResult=await runtime.render(`flowchart LR\nA@{ img: "${pixel}", label: "Embedded" }`);
assert.equal(imageResult.model.nodes[0].image.naturalWidth,1);
const svgOnlyFile=path.join(temp,'svg-only.mmd');await fs.writeFile(svgOnlyFile,'flowchart LR\nA --> B');
const svgOnly=run(['render',svgOnlyFile,'--out',path.join(temp,'svg-only')]);assert(!svgOnly.files.png);
runtime.close();console.log('PASS bundled AWS/GCP/service icons, unknown icon error, four-direction arrows, embedded image, SVG-only output');
