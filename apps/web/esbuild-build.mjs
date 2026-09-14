import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  outfile: 'dist/assets/main.js',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

copyFileSync('index.html', 'dist/index.html');
console.log('web build complete → dist/');
