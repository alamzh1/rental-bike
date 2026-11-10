import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC нужен для emitDecoratorMetadata — без него DI NestJS в тестах не работает.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['test/integration/**', 'node_modules/**'],
  },
});
