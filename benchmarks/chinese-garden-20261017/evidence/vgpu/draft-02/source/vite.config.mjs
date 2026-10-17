import { defineConfig } from 'vite';
import { wgslVitePlugin } from 'vgpu/client';
export default defineConfig({base:'./',plugins:[wgslVitePlugin()],build:{outDir:'dist',emptyOutDir:true}});
