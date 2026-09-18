import { defineConfig } from 'vite';
export default defineConfig({build:{outDir:'dist',lib:{entry:'src/index.ts',formats:['es'],fileName:'archmap-mermaid'},rollupOptions:{output:{inlineDynamicImports:true}}}});
