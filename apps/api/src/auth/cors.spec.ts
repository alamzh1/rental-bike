import { describe, expect, it } from 'vitest';
import { corsAllowed } from './cors';

const env = { MINIAPP_URL: 'https://app.x.io/', ADMIN_URL: 'https://admin.x.io', NODE_ENV: 'production' } as NodeJS.ProcessEnv;

describe('CORS', () => {
  it('свои адреса и запросы без Origin — да; чужие сайты — нет', () => {
    expect(corsAllowed('https://app.x.io', env)).toBe(true);
    expect(corsAllowed('https://admin.x.io', env)).toBe(true);
    expect(corsAllowed(undefined, env)).toBe(true);
    expect(corsAllowed('https://evil.io', env)).toBe(false);
    expect(corsAllowed('https://app.x.io.evil.io', env)).toBe(false);
  });

  it('localhost — только в разработке', () => {
    expect(corsAllowed('http://localhost:5173', env)).toBe(false);
    expect(corsAllowed('http://localhost:5173', { ...env, NODE_ENV: 'development' })).toBe(true);
    expect(corsAllowed('http://localhost.evil.io', { ...env, NODE_ENV: 'development' })).toBe(false);
  });
});
