import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AuthorSchema,
  BuildSchema,
  MasterySchema,
  SourceSchema,
  TierListSchema,
  type Author,
  type Source,
  type TierEntry,
  type TierList,
} from '@gd/domain';

export interface CatalogInput {
  masteries: readonly unknown[];
  builds: readonly unknown[];
  author: Author;
  source: Source;
  gameVersion: string;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Fixture generation only. No network, database, clock, inferred rankings or rights upgrades. */
export function generateCatalog(input: CatalogInput): TierList {
  const author = AuthorSchema.parse(input.author);
  const source = SourceSchema.parse(input.source);
  if (author.is_placeholder) throw new Error('El catálogo necesita autoría identificada.');
  const masteries = input.masteries
    .map((raw) => MasterySchema.parse(raw))
    .sort((a, b) => compare(a.slug, b.slug));
  if (
    masteries.length < 2 ||
    new Set(masteries.map((mastery) => mastery.slug)).size !== masteries.length
  )
    throw new Error('Catálogo de maestrías incompleto o duplicado.');
  const builds = input.builds
    .map((raw) => BuildSchema.parse(raw))
    .sort((a, b) => compare(a.slug, b.slug));
  if (new Set(builds.map((build) => build.slug)).size !== builds.length)
    throw new Error('Build duplicada.');
  const sources = new Map<string, Source>([[source.slug, source]]);
  const combinations: TierList['combinations'] = [];
  const entries: TierEntry[] = [];
  const entry = (overrides: Partial<TierEntry>): TierEntry => ({
    entry_kind: 'placeholder',
    combination_slug: '',
    display_name: null,
    build_slug: null,
    tier: 'sin_clasificar',
    content_status: 'placeholder',
    rights_status: 'own_original',
    review_state: 'publicado',
    external_url: null,
    external_author: null,
    source_slug: source.slug,
    evaluated_on: null,
    ...overrides,
  });
  for (let index = 0; index < masteries.length; index++) {
    const a = masteries[index]!;
    for (const b of masteries.slice(index + 1)) {
      const slug = `${a.slug}-${b.slug}`;
      combinations.push({ slug, mastery_a_slug: a.slug, mastery_b_slug: b.slug });
      entries.push(entry({ combination_slug: slug, display_name: `${a.name_es} + ${b.name_es}` }));
    }
  }
  for (const build of builds) {
    if (build.rights_status === 'link_only')
      throw new Error('link_only requiere tarjeta externa, no guía nativa.');
    const pair = [build.title_a_mastery_slug, build.title_b_mastery_slug];
    const combination = combinations.find(
      (item) => pair.includes(item.mastery_a_slug) && pair.includes(item.mastery_b_slug),
    );
    if (!combination || !build.sources[0])
      throw new Error('Build sin combinación o procedencia compatibles.');
    for (const item of build.sources) {
      const previous = sources.get(item.slug);
      if (previous && JSON.stringify(previous) !== JSON.stringify(item))
        throw new Error('Fuente con datos contradictorios.');
      sources.set(item.slug, item);
    }
    entries.push(
      entry({
        entry_kind: 'build_propia',
        combination_slug: combination.slug,
        display_name: build.title,
        build_slug: build.slug,
        content_status: build.content_status,
        rights_status: build.rights_status,
        review_state: build.review_state,
        source_slug: build.sources[0].slug,
      }),
    );
  }
  return TierListSchema.parse({
    slug: 'principal',
    locale: 'es',
    title: 'Catálogo de combinaciones de maestrías',
    game_version: input.gameVersion,
    review_state: 'publicado',
    author_slug: author.slug,
    masteries,
    combinations,
    entries,
    sources: [...sources.values()].sort((a, b) => compare(a.slug, b.slug)),
  });
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

async function main(argv: string[]): Promise<number> {
  try {
    let dir = 'content';
    let check = false;
    for (let index = 0; index < argv.length; index++) {
      if (argv[index] === '--check') check = true;
      else if (argv[index] === '--dir' && argv[index + 1] && !argv[index + 1]!.startsWith('--'))
        dir = argv[++index]!;
      else throw new Error('Argumento desconocido.');
    }
    const root = resolve(dir);
    const masteries = await readJson(join(root, 'masteries.json'));
    if (!Array.isArray(masteries)) throw new Error('Se esperaba una lista de maestrías.');
    const builds = [];
    for (const file of (await readdir(join(root, 'builds')))
      .filter((file) => file.endsWith('.json'))
      .sort(compare)) {
      builds.push(await readJson(join(root, 'builds', file)));
    }
    const catalog = generateCatalog({
      masteries,
      builds,
      author: AuthorSchema.parse(await readJson(join(root, 'authors/grim-dawn-builds.json'))),
      source: SourceSchema.parse(await readJson(join(root, 'sources/catalogo-maestrias.json'))),
      gameVersion: '1.3.x (Fangs of Asterkarn)',
    });
    const rendered = JSON.stringify(catalog, null, 2) + '\n';
    const output = join(root, 'tier-lists/principal.json');
    if (check) {
      if ((await readFile(output, 'utf8')).replace(/\r\n/g, '\n') !== rendered)
        throw new Error('Catálogo desactualizado.');
    } else {
      await mkdir(join(root, 'tier-lists'), { recursive: true });
      await writeFile(output, rendered);
    }
    console.log(
      `gen-catalog OK (${catalog.masteries.length} maestrías, ${catalog.combinations.length} pares; ${check ? 'comprobación' : 'fixture generado'})`,
    );
    return 0;
  } catch {
    // JSON/Zod errors can include document values. Never echo their input or cause.
    console.error(
      'gen-catalog FALLÓ: revisa argumentos, maestrías, atribución, referencias y vigencia del fixture.',
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
