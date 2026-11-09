import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

describe('@gd/api manifest', () => {
  it('depends only on @gd/domain, fastify and zod at runtime', () => {
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@gd/domain',
      'fastify',
      'zod',
    ]);
  });

  it('has no database driver or ORM dependency', () => {
    const all = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    for (const forbidden of ['drizzle-orm', 'pg', 'postgres', 'postgres-js', 'mysql2', 'redis']) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('pins the engine to Node 22', () => {
    expect(manifest.engines?.['node']).toBe('>=22 <23');
  });
});
