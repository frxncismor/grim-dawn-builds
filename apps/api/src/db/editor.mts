import { lstat, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import pg from 'pg';
import { z } from 'zod';
import {
  AssetSchema,
  AuthorSchema,
  BuildDocumentSchema,
  MasterySchema,
  SourceSchema,
  TierListSchema,
  type BuildDocument,
  type TierList,
} from '@gd/domain';
import { loadSecrets } from '../config.js';
import {
  writeContentRows,
  type SeedClient,
  type Table,
  type ContentWritePolicy,
} from './write-content.mjs';
import type { SeedData } from './seed.mjs';

type Kind = 'build' | 'tier-list';
const Envelope = z
  .object({
    document: z.unknown(),
    dependencies: z
      .object({
        authors: z.array(AuthorSchema).default([]),
        sources: z.array(SourceSchema).default([]),
        masteries: z.array(MasterySchema).default([]),
        assets: z.array(AssetSchema).default([]),
      })
      .strict()
      .default({ authors: [], sources: [], masteries: [], assets: [] }),
    createMissingDependencies: z.boolean().default(false),
  })
  .strict();
export class EditorError extends Error {
  constructor(
    readonly code:
      | 'arguments'
      | 'invalid-content'
      | 'dependency-conflict'
      | 'dependency-missing'
      | 'role'
      | 'database-failed'
      | 'credentials',
  ) {
    super(`editor: ${code}`);
    this.name = 'EditorError';
  }
}
export interface PreparedEdit {
  kind: Kind;
  slug: string;
  document: BuildDocument | TierList;
  dependencies: z.infer<typeof Envelope>['dependencies'];
  createMissingDependencies: boolean;
}

export function prepareEdit(kind: string, slug: string, raw: unknown): PreparedEdit {
  if (kind !== 'build' && kind !== 'tier-list') throw new EditorError('arguments');
  const input = Envelope.safeParse(raw);
  if (!input.success) throw new EditorError('invalid-content');
  const parsed = (kind === 'build' ? BuildDocumentSchema : TierListSchema).safeParse(
    input.data.document,
  );
  if (!parsed.success || parsed.data.slug !== slug) throw new EditorError('invalid-content');
  const document = parsed.data;
  const authorSlugs = new Set([document.author_slug]);
  const sourceSlugs = new Set(document.sources.map((source) => source.slug));
  const masterySlugs = new Set(document.masteries.map((mastery) => mastery.slug));
  const assetSlugs = new Set(
    [
      ...input.data.dependencies.masteries.map((mastery) => mastery.asset_slug),
      ...(kind === 'tier-list'
        ? (document as TierList).masteries.map((mastery) => mastery.asset_slug)
        : []),
    ].filter((value): value is string => value !== null),
  );
  for (const [key, allowed] of [
    ['authors', authorSlugs],
    ['sources', sourceSlugs],
    ['masteries', masterySlugs],
    ['assets', assetSlugs],
  ] as const) {
    const resources = input.data.dependencies[key];
    if (
      new Set(resources.map((resource) => resource.slug)).size !== resources.length ||
      resources.some((resource) => !allowed.has(resource.slug))
    )
      throw new EditorError('invalid-content');
  }
  for (const source of input.data.dependencies.sources)
    if (
      !isDeepStrictEqual(
        document.sources.find((item) => item.slug === source.slug),
        source,
      )
    )
      throw new EditorError('dependency-conflict');
  if (kind === 'build') {
    const build = document as BuildDocument;
    for (const author of input.data.dependencies.authors)
      if (!isDeepStrictEqual(author, build.author)) throw new EditorError('dependency-conflict');
    for (const mastery of input.data.dependencies.masteries) {
      const nested = build.masteries.find((item) => item.slug === mastery.slug);
      if (!nested || nested.name_es !== mastery.name_es || nested.name_en !== mastery.name_en)
        throw new EditorError('dependency-conflict');
    }
  } else
    for (const mastery of input.data.dependencies.masteries)
      if (
        !isDeepStrictEqual(
          (document as TierList).masteries.find((item) => item.slug === mastery.slug),
          mastery,
        )
      )
        throw new EditorError('dependency-conflict');
  return {
    kind,
    slug,
    document,
    dependencies: input.data.dependencies,
    createMissingDependencies: input.data.createMissingDependencies,
  };
}

const quote = (value: string) => {
  if (!/^[a-z_]+$/.test(value)) throw new EditorError('database-failed');
  return `"${value}"`;
};

/** Role and transaction belong to the editor, never to a caller-selected mode. */
export async function editData(
  client: SeedClient,
  input: PreparedEdit,
): Promise<{ builds: number; tierLists: number }> {
  await client.query('BEGIN');
  try {
    const role = (
      await client.query(`SELECT current_user AS role,
      (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls) AS privileged
      FROM pg_roles WHERE rolname=current_user`)
    ).rows[0];
    if (role?.['role'] !== 'editor' || role['privileged'] !== false) throw new EditorError('role');
    const createdSkills = new Set<string>();
    const reference = async (table: Table, slug: string): Promise<string> => {
      const row = (await client.query(`SELECT id FROM ${quote(table)} WHERE slug=$1`, [slug]))
        .rows[0];
      if (typeof row?.['id'] !== 'string') throw new EditorError('dependency-missing');
      return row['id'];
    };
    const resource = async (
      table: Table,
      fields: Record<string, unknown>,
      conflict = ['slug'],
    ): Promise<string> => {
      const columns = Object.keys(fields);
      const values = columns.map((column) => fields[column]);
      const equality = columns
        .map((column, index) => `${quote(column)} IS NOT DISTINCT FROM $${index + 1}`)
        .join(' AND ');
      const key = conflict
        .map((column) => `${quote(column)}=$${columns.indexOf(column) + 1}`)
        .join(' AND ');
      const row = (
        await client.query(
          `SELECT id, (${equality}) AS compatible FROM ${quote(table)} WHERE ${key} FOR UPDATE`,
          values,
        )
      ).rows[0];
      if (row) {
        if (row['compatible'] !== true || typeof row['id'] !== 'string')
          throw new EditorError('dependency-conflict');
        return row['id'];
      }
      if (!input.createMissingDependencies) throw new EditorError('dependency-missing');
      const insertFields =
        table === 'authors' || table === 'sources' ? { ...fields, origin: 'editor' } : fields;
      const names = Object.keys(insertFields);
      const inserted = await client.query(
        `INSERT INTO ${quote(table)} (${names.map(quote).join(',')}) VALUES (${names.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT (${conflict.map(quote).join(',')}) DO NOTHING RETURNING id`,
        names.map((column) => insertFields[column]),
      );
      const id = inserted.rows[0]?.['id'];
      if (typeof id !== 'string') {
        // A concurrent creator may have won. Compare that row; never overwrite it.
        const concurrent = (
          await client.query(
            `SELECT id, (${equality}) AS compatible FROM ${quote(table)} WHERE ${key} FOR UPDATE`,
            values,
          )
        ).rows[0];
        if (concurrent?.['compatible'] !== true || typeof concurrent['id'] !== 'string')
          throw new EditorError('dependency-conflict');
        return concurrent['id'];
      }
      if (table === 'skills') createdSkills.add(id);
      return id;
    };
    const data: SeedData = {
      authors:
        input.kind === 'build'
          ? [(input.document as BuildDocument).author]
          : [...input.dependencies.authors],
      sources: [...input.document.sources],
      masteries:
        input.kind === 'tier-list'
          ? [...(input.document as TierList).masteries]
          : [...input.dependencies.masteries],
      assets: [...input.dependencies.assets],
      builds: input.kind === 'build' ? [input.document as BuildDocument] : [],
      tierLists: input.kind === 'tier-list' ? [input.document as TierList] : [],
    };
    const references: NonNullable<ContentWritePolicy['references']> = {
      authors: new Map(),
      assets: new Map(),
      masteries: new Map(),
      builds: new Map(),
    };
    if (!data.authors.length)
      references.authors!.set(
        input.document.author_slug,
        await reference('authors', input.document.author_slug),
      );
    for (const mastery of data.masteries)
      if (mastery.asset_slug && !data.assets.some((asset) => asset.slug === mastery.asset_slug))
        references.assets!.set(mastery.asset_slug, await reference('assets', mastery.asset_slug));
    if (input.kind === 'build')
      for (const mastery of (input.document as BuildDocument).masteries) {
        if (data.masteries.some((item) => item.slug === mastery.slug)) continue;
        const row = (
          await client.query('SELECT id, name_es, name_en FROM masteries WHERE slug=$1 FOR SHARE', [
            mastery.slug,
          ])
        ).rows[0];
        if (typeof row?.['id'] !== 'string') throw new EditorError('dependency-missing');
        if (row['name_es'] !== mastery.name_es || row['name_en'] !== mastery.name_en)
          throw new EditorError('dependency-conflict');
        references.masteries!.set(mastery.slug, row['id']);
      }
    const externalBuilds: NonNullable<ContentWritePolicy['externalBuilds']> = new Map();
    if (input.kind === 'tier-list')
      for (const entry of (input.document as TierList).entries) {
        if (!entry.build_slug) continue;
        const row = (
          await client.query(
            'SELECT id, review_state, rights_status, content_status, damage_types, playstyle, content_tags FROM builds WHERE slug=$1 FOR SHARE',
            [entry.build_slug],
          )
        ).rows[0];
        if (typeof row?.['id'] !== 'string') throw new EditorError('dependency-missing');
        if (
          row['review_state'] !== entry.review_state ||
          row['rights_status'] !== entry.rights_status ||
          row['content_status'] !== entry.content_status
        )
          throw new EditorError('dependency-conflict');
        references.builds!.set(entry.build_slug, row['id']);
        externalBuilds.set(entry.build_slug, {
          damage_types: row['damage_types'] as BuildDocument['damage_types'],
          playstyle: row['playstyle'] as BuildDocument['playstyle'],
          content_tags: row['content_tags'] as BuildDocument['content_tags'],
        });
      }
    const policy: ContentWritePolicy = {
      origin: 'editor',
      references,
      externalBuilds,
      resource,
      root: async (table, fields) => {
        if (table === 'authors' || table === 'sources') return resource(table, fields);
        if (
          table !== (input.kind === 'build' ? 'builds' : 'tier_lists') ||
          fields['slug'] !== input.slug
        )
          throw new EditorError('arguments');
        const values: Record<string, unknown> = { ...fields, origin: 'editor' };
        const columns = Object.keys(values);
        const result = await client.query(
          `INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT (slug) DO UPDATE SET ${columns
            .filter((column) => column !== 'slug')
            .map((column) => `${quote(column)}=EXCLUDED.${quote(column)}`)
            .join(',')} RETURNING id`,
          columns.map((column) => values[column]),
        );
        const id = result.rows[0]?.['id'];
        if (typeof id !== 'string') throw new EditorError('database-failed');
        return id;
      },
      skillParent: async (id, parent) => {
        if (createdSkills.has(id))
          await client.query('UPDATE skills SET parent_skill_id=$1 WHERE id=$2', [parent, id]);
        else {
          const result = await client.query(
            'SELECT id FROM skills WHERE id=$1 AND parent_skill_id IS NOT DISTINCT FROM $2',
            [id, parent],
          );
          if (!result.rows.length) throw new EditorError('dependency-conflict');
        }
      },
    };
    await writeContentRows(client, data, policy);
    await client.query('COMMIT');
    return { builds: data.builds.length, tierLists: data.tierLists.length };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof EditorError) throw error;
    throw new EditorError('database-failed');
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
  DB_USER_EDITOR: z.literal('editor').default('editor'),
});
interface EditorDependencies {
  read(file: string): Promise<unknown>;
  createClient(config: pg.ClientConfig): pg.Client;
  write: { out(line: string): void; err(line: string): void };
}
export async function runEditor(
  env: Readonly<Record<string, string | undefined>>,
  args: string[],
  overrides: Partial<EditorDependencies> = {},
): Promise<number> {
  const write = overrides.write ?? { out: console.log, err: console.error };
  if (!['development', 'test'].includes(env['APP_ENV'] ?? '')) {
    write.err('editor failed: environment');
    return 1;
  }
  let client: pg.Client | undefined;
  try {
    if (args.length !== 6) throw new EditorError('arguments');
    const options = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index]!;
      const value = args[index + 1]!;
      if (!['--kind', '--slug', '--file'].includes(key) || !value || options.has(key))
        throw new EditorError('arguments');
      options.set(key, value);
    }
    const read =
      overrides.read ??
      (async (file: string) => {
        const stat = await lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024)
          throw new EditorError('invalid-content');
        return JSON.parse(await readFile(file, 'utf8')) as unknown;
      });
    const input = prepareEdit(
      options.get('--kind')!,
      options.get('--slug')!,
      await read(options.get('--file')!),
    );
    const config = Config.safeParse(env);
    if (!config.success || !env['DB_PASSWORD_EDITOR_FILE'] || env['DB_PASSWORD_EDITOR'])
      throw new EditorError('credentials');
    const secret = loadSecrets(
      [
        {
          key: 'editorPassword',
          env: 'DB_PASSWORD_EDITOR',
          secretName: 'db_password_editor',
          required: true,
        },
      ],
      env,
    )['editorPassword'];
    if (!secret) throw new EditorError('credentials');
    client = (overrides.createClient ?? ((configuration) => new pg.Client(configuration)))({
      host: config.data.DB_HOST,
      port: config.data.DB_PORT,
      database: config.data.POSTGRES_DB,
      user: 'editor',
      password: secret.reveal(),
      application_name: 'gd-editor',
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
    });
    await client.connect();
    const result = await editData(client, input);
    write.out(`editor complete: ${result.builds} builds, ${result.tierLists} tier lists`);
    return 0;
  } catch (error) {
    write.err(`editor failed: ${error instanceof EditorError ? error.code : 'database-failed'}`);
    return 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await runEditor(process.env, process.argv.slice(2));
