import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import {
  selectGitleaksAsset,
  installGitleaksAsset,
  verifyGitleaksArchive,
  GITLEAKS_VERSION,
} from './setup-gitleaks.mts';

const cleanup = async (root: string) => {
  assert.equal(dirname(root), tmpdir());
  assert.ok(basename(root).startsWith('gd-gitleaks-'));
  await rm(root, { recursive: true, force: true });
};
test('native assets are pinned to official HTTPS releases and unsupported platforms fail closed', () => {
  for (const platform of ['win32', 'linux']) {
    const asset = selectGitleaksAsset(platform, 'x64');
    assert.match(
      asset.url,
      /^https:\/\/github\.com\/gitleaks\/gitleaks\/releases\/download\/v8\.30\.1\//,
    );
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(GITLEAKS_VERSION, '8.30.1');
  assert.throws(() => selectGitleaksAsset('darwin', 'arm64'));
});
test('archive hash is checked before extraction or execution', async () => {
  assert.throws(() => verifyGitleaksArchive(Buffer.from('invalid'), 'a'.repeat(64)));
  const root = await mkdtemp(join(tmpdir(), 'gd-gitleaks-invalid-'));
  try {
    let touched = false;
    await assert.rejects(
      installGitleaksAsset(root, selectGitleaksAsset('win32', 'x64'), {
        download: async () => Buffer.from('invalid'),
        extract: async () => {
          touched = true;
        },
        version: () => {
          touched = true;
          return '8.30.1';
        },
      }),
    );
    assert.equal(touched, false);
  } finally {
    await cleanup(root);
  }
});
test('verified native executable is promoted atomically only with the exact version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-gitleaks-install-'));
  const archive = Buffer.from('synthetic offline archive');
  const asset = {
    ...selectGitleaksAsset('win32', 'x64'),
    sha256: createHash('sha256').update(archive).digest('hex'),
  };
  try {
    const ops = {
      download: async () => archive,
      extract: async (_file: string, folder: string, binary: string) => {
        await writeFile(join(folder, binary), 'verified native fixture');
      },
      version: () => '8.30.1',
    };
    const installed = await installGitleaksAsset(root, asset, ops);
    assert.equal(await readFile(installed, 'utf8'), 'verified native fixture');
    await assert.rejects(installGitleaksAsset(root, asset, { ...ops, version: () => '0.0.0' }));
    assert.equal(await readFile(installed, 'utf8'), 'verified native fixture');
  } finally {
    await cleanup(root);
  }
});
test('installer refuses symlinked tool roots before downloading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gd-gitleaks-path-'));
  try {
    await mkdir(join(root, 'other'));
    await symlink(join(root, 'other'), join(root, '.tools'), 'junction');
    let downloaded = false;
    await assert.rejects(
      installGitleaksAsset(root, selectGitleaksAsset('win32', 'x64'), {
        download: async () => {
          downloaded = true;
          return Buffer.alloc(0);
        },
      }),
    );
    assert.equal(downloaded, false);
  } finally {
    await cleanup(root);
  }
});
