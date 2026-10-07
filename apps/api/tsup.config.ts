import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/migrate.ts'],
  format: 'esm',
  target: 'node22',
  // The workspace packages point `main` at TypeScript source, which plain
  // `node` cannot load. Bundle them; npm dependencies stay external.
  noExternal: [/^@postly\//],
  clean: true,
});
