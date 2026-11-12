import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * T-071 blocker 2: `@gd/domain` must be consumable by plain Node ESM. Its exports
 * point to emitted JavaScript and declarations (dist), never to raw TypeScript.
 * Lives in scripts/ because it performs I/O, which the domain purity boundary
 * forbids (plan §12.4). Run after `pnpm --filter @gd/domain build`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_ROOT = resolve(ROOT, 'packages', 'domain');

interface DomainPackageJson {
  exports: Record<string, Record<string, string>>;
  scripts: Record<string, string>;
}

const pkg = JSON.parse(
  readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8'),
) as DomainPackageJson;

const EXPECTED_EXPORTS = {
  '.': { types: './dist/src/index.d.ts', default: './dist/src/index.js' },
  './vocabulary': { types: './dist/src/vocabulary.d.ts', default: './dist/src/vocabulary.js' },
  './testing': {
    types: './dist/testing/repository-contract.d.ts',
    default: './dist/testing/repository-contract.js',
  },
};

describe('@gd/domain package metadata (T-071 runtime build)', () => {
  it('points every export at emitted JavaScript and declarations, not raw TypeScript', () => {
    assert.deepEqual(pkg.exports, EXPECTED_EXPORTS);
    for (const target of Object.values(pkg.exports).flatMap((t) => Object.values(t))) {
      assert.match(target, /^\.\/dist\/.+\.(js|d\.ts)$/);
    }
  });

  it('declares build and clean scripts', () => {
    assert.equal(pkg.scripts.build, 'tsc -p tsconfig.build.json');
    assert.match(pkg.scripts.clean ?? '', /dist/);
  });

  it('builds only production sources (specs are excluded and declarations emitted)', () => {
    const config = JSON.parse(
      readFileSync(resolve(PACKAGE_ROOT, 'tsconfig.build.json'), 'utf8'),
    ) as { exclude: string[]; compilerOptions: Record<string, unknown> };
    assert.ok(config.exclude.includes('**/*.spec.ts'));
    assert.equal(config.compilerOptions.noEmit, false);
    assert.equal(config.compilerOptions.declaration, true);
    assert.equal(config.compilerOptions.outDir, 'dist');
  });
});

describe('@gd/domain built output', () => {
  const emitted = Object.values(EXPECTED_EXPORTS).flatMap((t) => Object.values(t));

  it('emits every artifact referenced by exports', () => {
    for (const relative of emitted) {
      assert.ok(existsSync(resolve(PACKAGE_ROOT, relative)), `${relative} missing: run build`);
    }
  });

  it('emits relative specifiers with .js extensions so Node ESM can load them', () => {
    const specifier = /(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g;
    for (const relative of emitted.filter((file) => file.endsWith('.js'))) {
      const source = readFileSync(resolve(PACKAGE_ROOT, relative), 'utf8');
      for (const match of source.matchAll(specifier)) {
        assert.match(match[1] ?? '', /\.js$/, `${relative} imports ${match[1]}`);
      }
    }
  });

  it('imports every subpath through its package name in plain Node ESM', () => {
    const script = [
      "const root = await import('@gd/domain');",
      "const vocab = await import('@gd/domain/vocabulary');",
      "const testing = await import('@gd/domain/testing');",
      'console.log(JSON.stringify({',
      '  root: Object.keys(root).sort(),',
      '  vocabulary: Object.keys(vocab).sort(),',
      '  testing: Object.keys(testing).sort(),',
      '}));',
    ].join('\n');

    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.stderr, '', 'node import failed');
    assert.equal(run.status, 0);

    const loaded = JSON.parse(run.stdout) as Record<string, string[]>;
    assert.deepEqual(loaded.root, [
      'AssetSchema',
      'AuthorSchema',
      'BuildDocumentSchema',
      'BuildSchema',
      'CONTENT_STATUSES',
      'MasteryCombinationSchema',
      'MasterySchema',
      'PublicAuthorSchema',
      'PublicBuildSchema',
      'PublicSourceSchema',
      'PublicTierListSchema',
      'SourceSchema',
      'TIERS',
      'TierEntrySchema',
      'TierListSchema',
      'checkAssetManifest',
      'publicFilter',
    ]);
    assert.deepEqual(loaded.vocabulary, ['CONTENT_STATUSES', 'TIERS']);
    assert.ok(loaded.testing.length > 0);
  });
});
