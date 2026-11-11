import { SeedError, writeContentRows, type SeedClient } from './write-content.mjs';
export { SeedError, type SeedClient } from './write-content.mjs';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  AssetSchema,
  AuthorSchema,
  BuildDocumentSchema,
  MasterySchema,
  SourceSchema,
  TierListSchema,
  type Asset,
  type Author,
  type BuildDocument,
  type Mastery,
  type Source,
  type TierList,
} from '@gd/domain';
import { loadSecrets } from '../config.js';
import { z } from 'zod';

export interface SeedInput {
  authors: unknown[];
  sources: unknown[];
  masteries: unknown[];
  builds: unknown[];
  tierLists: unknown[];
  assets: unknown[];
}
export interface SeedData {
  authors: Author[];
  sources: Source[];
  masteries: Mastery[];
  builds: BuildDocument[];
  tierLists: TierList[];
  assets: Asset[];
}
function valid<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SeedError('invalid-content');
  return result.data;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SeedError('invalid-content');
  return value as Record<string, unknown>;
}
function merge<T extends { slug: string }>(map: Map<string, T>, value: T): void {
  const previous = map.get(value.slug);
  if (previous && !isDeepStrictEqual(previous, value)) throw new SeedError('conflicting-resource');
  map.set(value.slug, value);
}
function unique<T extends { slug: string }>(items: T[]): T[] {
  if (new Set(items.map((item) => item.slug)).size !== items.length)
    throw new SeedError('duplicate');
  return items.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Validate the complete batch before any database connection or mutation. */
export function prepareSeed(input: SeedInput): SeedData {
  const authors = new Map(
    unique(input.authors.map((raw) => valid(AuthorSchema, raw))).map((a) => [a.slug, a]),
  );
  const sources = new Map(
    unique(input.sources.map((raw) => valid(SourceSchema, raw))).map((s) => [s.slug, s]),
  );
  for (const raw of [...input.builds, ...input.tierLists]) {
    const doc = object(raw);
    if (doc['author']) merge(authors, valid(AuthorSchema, doc['author']));
    if (Array.isArray(doc['sources']))
      for (const source of doc['sources']) merge(sources, valid(SourceSchema, source));
  }
  const builds = unique(
    input.builds.map((raw) => {
      const doc = object(raw);
      const author = authors.get(String(doc['author_slug']));
      const refs = doc['source_slugs'];
      if (!author || !Array.isArray(refs)) throw new SeedError('reference');
      const selected = refs.map((slug) => {
        const source = sources.get(String(slug));
        if (!source) throw new SeedError('reference');
        return source;
      });
      return valid(BuildDocumentSchema, { ...doc, author, sources: selected });
    }),
  );
  const tierLists = unique(input.tierLists.map((raw) => valid(TierListSchema, raw)));
  const masteries = unique(input.masteries.map((raw) => valid(MasterySchema, raw)));
  const masteryBySlug = new Map(masteries.map((m) => [m.slug, m]));
  const buildBySlug = new Map(builds.map((b) => [b.slug, b]));
  const assets = unique(input.assets.map((raw) => valid(AssetSchema, raw)));
  const assetSlugs = new Set(assets.map((a) => a.slug));
  const combinations = new Map<string, TierList['combinations'][number]>();
  const skills = new Map<
    string,
    {
      slug: string;
      name_es: string;
      name_en: string;
      bar_required: number;
      parent_slug: string | null;
    }
  >();
  const constellations = new Map<string, BuildDocument['constellations'][number]>();
  for (const mastery of masteries)
    if (mastery.asset_slug && !assetSlugs.has(mastery.asset_slug)) throw new SeedError('reference');
  for (const build of builds) {
    for (const mastery of build.masteries) {
      const catalog = masteryBySlug.get(mastery.slug);
      if (!catalog || catalog.name_es !== mastery.name_es || catalog.name_en !== mastery.name_en)
        throw new SeedError('reference');
    }
    for (const node of build.skill_nodes) {
      const key = `${node.mastery_slug}/${node.slug}`;
      const value = {
        slug: key,
        name_es: node.name_es,
        name_en: node.name_en,
        bar_required: node.bar_required,
        parent_slug: node.parent_slug,
      };
      merge(skills, value);
    }
    for (const constellation of build.constellations) merge(constellations, constellation);
  }
  for (const tier of tierLists) {
    if (!authors.has(tier.author_slug)) throw new SeedError('reference');
    for (const mastery of tier.masteries)
      if (!isDeepStrictEqual(masteryBySlug.get(mastery.slug), mastery))
        throw new SeedError('reference');
    for (const combination of tier.combinations) merge(combinations, combination);
    for (const entry of tier.entries)
      if (entry.build_slug && !buildBySlug.has(entry.build_slug)) throw new SeedError('reference');
    for (const source of tier.sources) merge(sources, source);
  }
  return {
    authors: unique([...authors.values()]),
    sources: unique([...sources.values()]),
    masteries,
    builds,
    tierLists,
    assets,
  };
}

export async function readSeedFixtures(
  root = fileURLToPath(new URL('../../../../content/', import.meta.url)),
): Promise<SeedData> {
  const json = async (path: string): Promise<unknown> => {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch {
      throw new SeedError('fixture-read');
    }
  };
  const collection = async (name: string): Promise<unknown[]> => {
    let entries;
    try {
      entries = await readdir(join(root, name), { withFileTypes: true });
    } catch {
      throw new SeedError('fixture-read');
    }
    const files = entries
      .filter((e) => e.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    if (files.some((e) => !e.isFile() || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(e.name)))
      throw new SeedError('fixture-read');
    return Promise.all(files.map((e) => json(join(root, name, e.name))));
  };
  const [authors, sources, builds, tierLists, rawMasteries, manifest] = await Promise.all([
    collection('authors'),
    collection('sources'),
    collection('builds'),
    collection('tier-lists'),
    json(join(root, 'masteries.json')),
    json(join(root, 'assets/manifest.json')),
  ]);
  const assets = object(manifest)['assets'];
  if (!Array.isArray(rawMasteries) || !Array.isArray(assets))
    throw new SeedError('invalid-content');
  return prepareSeed({ authors, sources, builds, tierLists, masteries: rawMasteries, assets });
}

/** Caller owns connection lifetime. No DDL, role changes, migration or production bootstrap. */
export async function seedData(
  client: SeedClient,
  data: SeedData,
): Promise<{ builds: number; tierLists: number }> {
  await client.query('BEGIN');
  try {
    const role = (
      await client.query(`SELECT current_user AS role,
      (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) AS privileged
      FROM pg_roles WHERE rolname = current_user`)
    ).rows[0];
    if (role?.['role'] !== 'importer' || role['privileged'] !== false) throw new SeedError('role');
    await client.query('LOCK TABLE content_origin IN SHARE ROW EXCLUSIVE MODE');
    const marker = await client.query(
      'SELECT EXISTS (SELECT 1 FROM content_origin) AS bootstrapped',
    );
    if (marker.rows[0]?.['bootstrapped'] !== false) throw new SeedError('bootstrapped');
    await writeContentRows(client, data);
    await client.query('COMMIT');
    return { builds: data.builds.length, tierLists: data.tierLists.length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof SeedError) throw error;
    throw new SeedError('database-failed');
  }
}

const Config = z.object({
  DB_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.:-]{1,253}$/)
    .default('db'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  POSTGRES_DB: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/)
    .default('gd_dev'),
  DB_USER_IMPORTER: z.literal('importer').default('importer'),
});
interface SeederDependencies {
  read: () => Promise<SeedData>;
  createClient: (config: pg.ClientConfig) => pg.Client;
  write: { out: (line: string) => void; err: (line: string) => void };
}
/** Fail closed before I/O in every environment except explicit local development/test. */
export async function runSeeder(
  env: Readonly<Record<string, string | undefined>>,
  overrides: Partial<SeederDependencies> = {},
): Promise<number> {
  const write = overrides.write ?? { out: console.log, err: console.error };
  if (env['APP_ENV'] !== 'development' && env['APP_ENV'] !== 'test') {
    write.err('seed failed: environment');
    return 1;
  }
  let client: pg.Client | undefined;
  try {
    const config = valid(Config, env);
    const data = await (overrides.read ?? readSeedFixtures)();
    const secrets = loadSecrets(
      [
        {
          key: 'importerPassword',
          env: 'DB_PASSWORD_IMPORTER',
          secretName: 'db_password_importer',
          required: true,
        },
      ],
      env,
    );
    const password = secrets['importerPassword'];
    if (!password) throw new SeedError('credentials');
    client = (overrides.createClient ?? ((config) => new pg.Client(config)))({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.POSTGRES_DB,
      user: config.DB_USER_IMPORTER,
      password: password.reveal(),
      application_name: 'gd-seed',
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });
    await client.connect();
    const result = await seedData(client, data);
    write.out(`seed complete: ${result.builds} builds, ${result.tierLists} tier lists`);
    return 0;
  } catch (error) {
    write.err(
      `seed failed: ${error instanceof SeedError ? error.code : 'configuration-or-database'}`,
    );
    return 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
}
if (
  process.argv[1] &&
  (await realpath(process.argv[1]).catch(() => '')) === fileURLToPath(import.meta.url)
)
  process.exitCode = await runSeeder(process.env);
