import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Manifest;

describe('@gd/api manifest', () => {
  it('depends only on @gd/domain, drizzle-orm, fastify, pg and zod at runtime', () => {
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@gd/domain',
      'drizzle-orm',
      'fastify',
      'pg',
      'zod',
    ]);
  });

  it('keeps drizzle-kit and @types/pg in devDependencies only', () => {
    expect(Object.keys(manifest.devDependencies ?? {})).toEqual(
      expect.arrayContaining(['drizzle-kit', '@types/pg']),
    );
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain('drizzle-kit');
    expect(Object.keys(manifest.dependencies ?? {})).not.toContain('@types/pg');
  });

  it('pins the database packages to exact versions', () => {
    const exact = /^\d+\.\d+\.\d+$/;
    const pinned = {
      'drizzle-orm': manifest.dependencies?.['drizzle-orm'],
      pg: manifest.dependencies?.['pg'],
      'drizzle-kit': manifest.devDependencies?.['drizzle-kit'],
      '@types/pg': manifest.devDependencies?.['@types/pg'],
    };
    for (const [name, version] of Object.entries(pinned)) {
      expect(version, name).toMatch(exact);
    }
  });

  it('has no other database driver or ORM dependency', () => {
    const all = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    for (const forbidden of ['postgres', 'postgres-js', 'mysql2', 'redis', 'prisma']) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('pins the engine to Node 22', () => {
    expect(manifest.engines?.['node']).toBe('>=22 <23');
  });

  it('builds @gd/domain before API typecheck and build (T-071 blocker 2)', () => {
    const prefix = 'pnpm --filter @gd/domain build && ';
    expect(manifest.scripts?.['typecheck']?.startsWith(prefix)).toBe(true);
    expect(manifest.scripts?.['build']?.startsWith(prefix)).toBe(true);
  });
});

describe('@gd/api TypeScript configuration (T-071 blockers 1 and 3)', () => {
  const readTsconfig = (file: string) =>
    JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')) as {
      compilerOptions: Record<string, string>;
      include: string[];
    };

  it('uses NodeNext module resolution because the API runs under Node ESM', () => {
    const tsconfig = readTsconfig('tsconfig.json');
    expect(tsconfig.compilerOptions['module']).toBe('NodeNext');
    expect(tsconfig.compilerOptions['moduleResolution']).toBe('NodeNext');
  });

  it('type-checks drizzle.config.ts alongside the sources', () => {
    expect(readTsconfig('tsconfig.json').include).toContain('drizzle.config.ts');
  });
});
