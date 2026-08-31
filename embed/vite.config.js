import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Library build for the embeddable hero.
 *
 * three and gsap are bundled in on purpose: the point of this build is that a
 * host page needs nothing but one script tag. If your site already ships three,
 * add them to `rollupOptions.external` and the bundle drops to a few KB.
 */
export default defineConfig({
  root: __dirname,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'ESVisualsHero',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'es-visuals-hero.mjs' : 'es-visuals-hero.umd.js'),
    },
    rollupOptions: {
      // Puts create/isSupported straight on the UMD global, so a script tag
      // gets `ESVisualsHero.create(...)` with no `.default` detour.
      output: { exports: 'named' },
    },
  },
});
