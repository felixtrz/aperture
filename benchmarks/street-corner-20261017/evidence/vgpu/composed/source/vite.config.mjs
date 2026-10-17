import { defineConfig } from 'vite';
import wgslVitePlugin from '@vgpu/wgsl/loader-vite';
export default defineConfig({base:'./',plugins:[wgslVitePlugin()],build:{target:'esnext'}});
