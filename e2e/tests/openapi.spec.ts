import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { apiUrl } from './support';

// История 58: docs/openapi.json совпадает с маршрутами запущенного API (@nestjs/swagger отдаёт их на /api/docs-json в dev).
// Расхождение → `pnpm openapi --build` и закоммитить файл.

type Doc = { paths: Record<string, Record<string, unknown>> };
const ops = (d: Doc) => Object.entries(d.paths).flatMap(([p, v]) => Object.keys(v).map((m) => `${m.toUpperCase()} ${p}`)).sort();

test('docs/openapi.json соответствует эндпоинтам API', async ({ request }) => {
  const file = JSON.parse(readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8')) as Doc;
  const live = (await (await request.get(apiUrl('/docs-json'))).json()) as Doc;
  expect(ops(file)).toEqual(ops(live));
  expect(ops(file).length).toBeGreaterThan(50);
});
