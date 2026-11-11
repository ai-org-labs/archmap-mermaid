/** Generate searchable keys from the exact renderer shipped in the plugin. */
export function iconCatalogTsv(api) {
 api.installDiagramIcons();
 const entries=api.getDiagramIconCatalog();
 if(!entries.length)throw Error('Bundled icon catalog is empty');
 const clean=value=>String(value).replace(/[\t\r\n]+/g,' ');
 return 'key\tlabel\n'+entries.map(({key,label})=>`${clean(key)}\t${clean(label)}`).join('\n')+'\n';
}
