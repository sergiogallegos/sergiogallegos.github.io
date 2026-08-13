import { cp, copyFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectRoot, 'dist');
const publicAssets = join(projectRoot, 'assets');

await build({
  root: projectRoot,
  base: './',
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    rollupOptions: {
      input: join(projectRoot, 'index.source.html'),
    },
  },
});

await rm(publicAssets, { recursive: true, force: true });
await cp(join(outputDirectory, 'assets'), publicAssets, { recursive: true });
await copyFile(join(outputDirectory, 'index.source.html'), join(projectRoot, 'index.html'));

console.log('RoboPlay production files published to /roboplay/.');
