import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { prepareSeed, readSeedFixtures, seedData, type SeedData } from '../src/db/seed.mjs';

import { bootstrapData, bootstrapPayloadHash } from '../src/db/bootstrap.mjs';
import { migrationFingerprint } from '../src/db/migration-state.js';
import { editData, prepareEdit } from '../src/db/editor.mjs';

const root = join(import.meta.dirname, '../../..');
const image = /^\s+image:\s+(postgres:[^\s]+)$/m.exec(
  readFileSync(join(root, 'infra/docker/compose.yaml'), 'utf8'),
)?.[1];
const suite =
  process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true' ? describe : describe.skip;
let container: string | undefined;
let admin: pg.Client | undefined;
let importer: pg.Client | undefined;
let data: SeedData;
let port = 0;
let serial = 0;
let database = '';
let editor: pg.Client | undefined;
let viewer: pg.Client | undefined;
function docker(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (result.status !== 0) throw new Error('Bootstrap PostgreSQL fixture command failed');
  return result.stdout.trim();
}

suite('atomic bootstrap on real PostgreSQL (T-072)', () => {
  beforeAll(async () => {
    if (!image || !/@sha256:[a-f0-9]{64}$/.test(image))
      throw new Error('Pinned PostgreSQL image required');
    docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    container = `gd-bootstrap-${process.pid}-${randomBytes(4).toString('hex')}`;
    docker([
      'run',
      '--detach',
      '--rm',
      '--name',
      container,
      '--memory',
      '512m',
      '--memory-swap',
      '512m',
      '--cpus',
      '0.5',
      '--pids-limit',
      '100',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=256m',
      '--env',
      'POSTGRES_DB=gd_bootstrap_template',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const result = spawnSync(
        'docker',
        [
          'exec',
          container,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres',
          '-d',
          'gd_bootstrap_template',
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 10000 },
      );
      if (result.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error('Bootstrap PostgreSQL fixture did not start');
    port = Number(
      docker([
        'inspect',
        '--format',
        '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ]),
    );
    admin = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'gd_bootstrap_template',
      connectionTimeoutMillis: 5000,
    });
    await admin.connect();
    await admin.query(`CREATE ROLE migrator NOLOGIN; CREATE ROLE importer LOGIN; CREATE ROLE editor LOGIN; CREATE ROLE api_ro NOLOGIN;
      GRANT CREATE ON DATABASE gd_bootstrap_template TO migrator; GRANT USAGE, CREATE ON SCHEMA public TO migrator; SET ROLE migrator;`);
    await migrate(drizzle(admin), { migrationsFolder: join(root, 'apps/api/drizzle') });
    await admin.query('RESET ROLE');
    await admin.end();
    admin = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
    await admin.connect();
    data = await readSeedFixtures(join(root, 'content'));
  }, 90000);
  afterAll(async () => {
    await admin?.end().catch(() => undefined);
    if (container) docker(['rm', '--force', container]);
  });

  beforeEach(async () => {
    database = 'gd_bootstrap_' + ++serial;
    await admin!.query('CREATE DATABASE ' + database + ' TEMPLATE gd_bootstrap_template');
    importer = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'importer',
      database,
      application_name: 'gd-bootstrap-test',
    });
    editor = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'editor',
      database,
      application_name: 'gd-bootstrap-editor',
    });
    await importer.connect();
    await editor.connect();
    viewer = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });
    await viewer.connect();
    await viewer.query('SET ROLE api_ro');
  });
  afterEach(async () => {
    await importer?.end();
    await editor?.end();
    await viewer?.end();
    await admin!.query('DROP DATABASE ' + database + ' WITH (FORCE)');
  });

  it('loads a complete pending fixture atomically and records canonical hash, migration and date once', async () => {
    expect(await bootstrapData(importer!, data)).toEqual({ builds: 1, tierLists: 1 });
    const marker = (
      await importer!.query(
        'SELECT payload_hash,migration_version,bootstrapped_at FROM content_origin',
      )
    ).rows[0];
    expect(marker.payload_hash).toBe(bootstrapPayloadHash(data));
    expect(marker.migration_version).toBe(migrationFingerprint());
    expect(marker.bootstrapped_at).toBeInstanceOf(Date);
    expect(
      (await importer!.query('SELECT review_state,rights_status,origin FROM builds')).rows[0],
    ).toEqual({ review_state: 'borrador', rights_status: 'pending', origin: 'bootstrap' });
    expect((await viewer!.query('SELECT count(*)::int AS n FROM v_public_builds')).rows[0].n).toBe(
      0,
    );
    expect(
      (await viewer!.query('SELECT count(*)::int AS n FROM v_public_tier_entries')).rows[0].n,
    ).toBe(45);
    await expect(bootstrapData(importer!, data)).rejects.toThrow('already');
    await expect(seedData(importer!, data)).rejects.toThrow('bootstrapped');
    for (const sql of [
      "UPDATE builds SET origin='editor'",
      'DELETE FROM build_notes',
      'DELETE FROM content_origin',
      'UPDATE content_origin SET payload_hash=payload_hash',
    ])
      await expect(importer!.query(sql)).rejects.toMatchObject({ code: '23514' });
    const doc = structuredClone(data.builds[0]!);
    doc.summary = 'Edited after real bootstrap';
    await editData(editor!, prepareEdit('build', doc.slug, { document: doc }));
    expect((await importer!.query('SELECT origin,summary FROM builds')).rows[0]).toEqual({
      origin: 'editor',
      summary: doc.summary,
    });
    expect(
      (await importer!.query('SELECT payload_hash FROM content_origin')).rows[0].payload_hash,
    ).toBe(marker.payload_hash);
  });

  it('refuses even one existing catalog row without altering it', async () => {
    await importer!.query(
      "INSERT INTO assets (slug,status,recorded_on,fallback_svg) VALUES ('existing-local-asset','pending','2026-11-09','mastery-generic')",
    );
    await expect(bootstrapData(importer!, data)).rejects.toThrow('not-empty');
    expect((await importer!.query('SELECT count(*)::int AS n FROM content_origin')).rows[0].n).toBe(
      0,
    );
    expect((await importer!.query('SELECT slug FROM assets')).rows[0].slug).toBe(
      'existing-local-asset',
    );
    expect((await importer!.query('SELECT count(*)::int AS n FROM builds')).rows[0].n).toBe(0);
  });

  it('refuses migration drift before writing content or the marker', async () => {
    const owner = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });
    await owner.connect();
    try {
      await owner.query(
        'DELETE FROM drizzle.__drizzle_migrations WHERE id=(SELECT max(id) FROM drizzle.__drizzle_migrations)',
      );
    } finally {
      await owner.end();
    }
    await expect(bootstrapData(importer!, data)).rejects.toThrow('migration');
    expect((await importer!.query('SELECT count(*)::int AS n FROM builds')).rows[0].n).toBe(0);
    expect((await importer!.query('SELECT count(*)::int AS n FROM content_origin')).rows[0].n).toBe(
      0,
    );
  });

  it('rolls back all content and the marker after a late failure', async () => {
    const owner = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database });
    await owner.connect();
    try {
      await owner.query(
        'ALTER TABLE tier_entries ADD CONSTRAINT bootstrap_rollback_probe CHECK (false) NOT VALID',
      );
      await expect(bootstrapData(importer!, data)).rejects.toThrow('database-failed');
      expect((await importer!.query('SELECT count(*)::int AS n FROM authors')).rows[0].n).toBe(0);
      expect((await importer!.query('SELECT count(*)::int AS n FROM builds')).rows[0].n).toBe(0);
      expect(
        (await importer!.query('SELECT count(*)::int AS n FROM content_origin')).rows[0].n,
      ).toBe(0);
    } finally {
      await owner.end();
    }
  });

  it('serializes simultaneous bootstrap attempts and permits exactly one', async () => {
    const other = new pg.Client({ host: '127.0.0.1', port, user: 'importer', database });
    await other.connect();
    try {
      const results = await Promise.allSettled([
        bootstrapData(importer!, data),
        bootstrapData(other, data),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(
        (await importer!.query('SELECT count(*)::int AS n FROM content_origin')).rows[0].n,
      ).toBe(1);
    } finally {
      await other.end();
    }
  });

  it.each(['seed', 'editor'])(
    'holds table locks against a concurrent %s writer until commit',
    async (kind) => {
      let unlock!: () => void;
      let notify!: () => void;
      const hold = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const locked = new Promise<void>((resolve) => {
        notify = resolve;
      });
      const wrapped = {
        query: async (sql: string, values?: unknown[]) => {
          const result = await importer!.query(sql, values);
          if (sql.startsWith('LOCK TABLE "assets"')) {
            notify();
            await hold;
          }
          return result;
        },
      };
      const bootstrap = bootstrapData(wrapped, data);
      const other = new pg.Client({
        host: '127.0.0.1',
        port,
        user: kind === 'seed' ? 'importer' : 'editor',
        database,
        application_name: 'gd-bootstrap-racing-writer',
      });
      await other.connect();
      let waiting: Promise<{ ok: boolean; error?: unknown }> | undefined;
      try {
        await Promise.race([
          locked,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Bootstrap lock not acquired')), 5000),
          ),
        ]);
        const doc = contractDoc('concurrent-editor');
        const operation =
          kind === 'seed'
            ? seedData(other, data)
            : editData(
                other,
                prepareEdit('build', doc.slug, {
                  document: doc,
                  createMissingDependencies: true,
                  dependencies: {
                    masteries: [data.masteries.find((item) => item.slug === 'chaman')!],
                  },
                }),
              );
        waiting = operation.then(
          () => ({ ok: true }),
          (error) => ({ ok: false, error }),
        );
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const state = await admin!.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='gd-bootstrap-racing-writer' AND wait_event_type='Lock') AS waiting",
          );
          if (state.rows[0].waiting) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blocked).toBe(true);
        unlock();
        await bootstrap;
        const result = await waiting;
        expect(result.ok).toBe(kind === 'editor');
        if (kind === 'seed') expect(String(result.error)).toContain('bootstrapped');
      } finally {
        unlock();
        await bootstrap.catch(() => undefined);
        await waiting;
        await other.end();
      }
    },
  );
});
