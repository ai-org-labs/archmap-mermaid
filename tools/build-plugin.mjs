import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.join(root,'plugin-dist'),target=path.join(output,'plugins/archmap-mermaid');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(target,{recursive:true});
await fs.cp(path.join(root,'plugins/archmap-mermaid'),target,{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
await fs.mkdir(path.join(target,'assets'),{recursive:true});
await fs.copyFile(path.join(root,'dist/archmap-mermaid.js'),path.join(target,'assets/archmap-mermaid.js'));
await fs.cp(path.join(root,'dist/licenses'),path.join(target,'licenses'),{recursive:true});
for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])await fs.copyFile(path.join(root,name),path.join(target,name));
const refs=path.join(target,'skills/diagram/references');await fs.mkdir(refs,{recursive:true});
// Copy the canonical docs at build time; do not maintain divergent plugin manuals.
for(const name of ['SYNTAX.md','DIAGRAM_LAYOUT_GUIDE.md','AI_PROMPT_TEMPLATE.md','LAYOUT_BALANCE.md']) {
 const text=await fs.readFile(path.join(root,'docs',name),'utf8');
 await fs.writeFile(path.join(refs,name),text.replaceAll('](diagrams/','](https://ai-org-labs.github.io/archmap-mermaid/docs/diagrams/'));
}
const marketplace={name:'archmap-local',interface:{displayName:'ArchMap'},plugins:[{name:'archmap-mermaid',source:{source:'local',path:'./plugins/archmap-mermaid'},policy:{installation:'AVAILABLE',authentication:'ON_USE'},category:'Developer Tools'}]};
await fs.mkdir(path.join(output,'.agents/plugins'),{recursive:true});
await fs.writeFile(path.join(output,'.agents/plugins/marketplace.json'),JSON.stringify(marketplace,null,2)+'\n');
const manifest=JSON.parse(await fs.readFile(path.join(target,'plugin.json')));
const archive=path.join(output,`archmap-mermaid-plugin-${manifest.version}.tgz`);
const result=spawnSync('tar',['-czf',archive,'-C',path.dirname(target),'archmap-mermaid'],{stdio:'inherit'});
if(result.status!==0)throw Error('Plugin archive failed');
console.log(JSON.stringify({plugin:target,marketplace:output,archive},null,2));

if(process.argv.includes('--distribution')){
 const destination=path.join(root,'distribution/archmap-mermaid');
 await fs.rm(destination,{recursive:true,force:true});
 await fs.mkdir(path.dirname(destination),{recursive:true});
 await fs.cp(target,destination,{recursive:true});
 const catalog={...marketplace,name:'archmap',plugins:marketplace.plugins.map(p=>({...p,source:{source:'local',path:'./distribution/archmap-mermaid'}}))};
 await fs.mkdir(path.join(root,'.agents/plugins'),{recursive:true});
 await fs.writeFile(path.join(root,'.agents/plugins/marketplace.json'),JSON.stringify(catalog,null,2)+'\n');
}

// Claude Code uses the same self-contained payload, with its own thin manifest.
const claudeCatalog={name:'archmap',owner:{name:'ai-org-labs'},metadata:{description:'Readable architecture diagrams with local SVG and PNG rendering'},plugins:[{name:manifest.name,source:'./distribution/archmap-mermaid',description:manifest.description}]};
if(process.argv.includes('--distribution')){
 await fs.mkdir(path.join(root,'.claude-plugin'),{recursive:true});
 await fs.writeFile(path.join(root,'.claude-plugin/marketplace.json'),JSON.stringify(claudeCatalog,null,2)+'\n');
}
// OpenAI submission requires plugin.json directly at the ZIP root.
const zip=path.join(output,`archmap-mermaid-plugin-${manifest.version}.zip`);
const zipped=spawnSync('zip',['-qr',zip,'.'],{cwd:target,stdio:'inherit'});
if(zipped.status!==0)throw Error('Submission ZIP failed');
console.log(JSON.stringify({submissionZip:zip}));
