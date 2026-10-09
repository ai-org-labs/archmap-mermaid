import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist/licenses',{recursive:true});
for(const [source,target] of [
  ['node_modules/@archmap/icons/LICENSE','archmap-icons-LICENSE'],
  ['node_modules/@archmap/icons/NOTICE','archmap-icons-NOTICE'],
  ['node_modules/mermaid/LICENSE','mermaid-LICENSE'],
  ['node_modules/js-yaml/LICENSE','js-yaml-LICENSE'],
]) await copyFile(source,`dist/licenses/${target}`);
