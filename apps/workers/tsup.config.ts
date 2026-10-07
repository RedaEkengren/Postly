import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  // See apps/api/tsup.config.ts.
  noExternal: [/^@postly\//],
  clean: true,
});
