import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  ALLOWED_IDENTICAL_IDS,
  checkLocaleParity,
  parseXliff,
  XliffParseError,
} from './check-locale-parity.mts';

const script = resolve(import.meta.dirname, 'check-locale-parity.mts');
const repo = resolve(import.meta.dirname, '..');

const xliff = (units: string) => `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es" datatype="plaintext" original="ng2.template">
    <body>
${units}
    </body>
  </file>
</xliff>`;

const unit = (id: string, source: string, target?: string) =>
  `      <trans-unit id="${id}" datatype="html">
        <source>${source}</source>${
          target === undefined
            ? ''
            : `
        <target state="translated">${target}</target>`
        }
      </trans-unit>`;

const enCatalog = () =>
  xliff(
    [
      unit('a.save', 'Save'),
      unit('a.hello', 'Hello <x id="PH" equiv-text="profile.name"/>'),
      unit('a.count', 'Count {n, plural, one {# item} other {# items}}'),
    ].join('\n'),
  );

const esCatalog = () =>
  xliff(
    [
      unit('a.save', 'Save', 'Guardar'),
      unit(
        'a.hello',
        'Hello <x id="PH" equiv-text="profile.name"/>',
        'Hola <x id="PH" equiv-text="profile.name"/>',
      ),
      unit(
        'a.count',
        'Count {n, plural, one {# item} other {# items}}',
        'Cuenta {n, plural, one {# objeto} other {# objetos}}',
      ),
    ].join('\n'),
  );

const categories = (en: string, es: string, allowedIdenticalIds: string[] = []) =>
  checkLocaleParity({ en, es, allowedIdenticalIds }).failures.map((failure) => failure.category);

test('parseXliff reads ids, sources and targets and decodes XML entities', () => {
  const units = parseXliff(
    xliff(unit('x.one', 'Author&apos;s &amp; site', 'Sitio &amp; autor del &quot;autor&quot;')),
  );
  assert.deepEqual(units, [
    { id: 'x.one', source: "Author's & site", target: 'Sitio & autor del "autor"' },
  ]);
  assert.equal(parseXliff(xliff(unit('x.two', 'Only source')))[0]!.target, null);
});

test('parseXliff keeps placeholder markers as tokens', () => {
  const [parsed] = parseXliff(xliff(unit('x.ph', 'Hi <x id="PH"/>', 'Hola <x id="PH"/>')));
  assert.equal(parsed!.source, 'Hi <x id="PH"/>');
  assert.equal(parsed!.target, 'Hola <x id="PH"/>');
});

test('valid parity passes with stats and no failures', () => {
  const result = checkLocaleParity({ en: enCatalog(), es: esCatalog(), allowedIdenticalIds: [] });
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.stats, { enUnits: 3, esUnits: 3, allowlisted: 0, identicalAllowed: 0 });
});

test('a unit missing in es fails with its id', () => {
  const es = xliff(unit('a.save', 'Save', 'Guardar'));
  const { failures } = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'id-set' && f.id === 'a.hello'));
});

test('a unit only present in es fails with its id', () => {
  const en = xliff(unit('a.save', 'Save'));
  const { failures } = checkLocaleParity({ en, es: esCatalog(), allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'id-set' && f.id === 'a.hello'));
  assert.ok(failures.some((f) => f.category === 'id-set' && f.id === 'a.count'));
});

test('an empty or whitespace-only es target fails', () => {
  for (const target of ['', '   \n  ']) {
    const es = xliff(
      [
        unit('a.save', 'Save', target),
        unit(
          'a.hello',
          'Hello <x id="PH" equiv-text="profile.name"/>',
          'Hola <x id="PH" equiv-text="profile.name"/>',
        ),
        unit(
          'a.count',
          'Count {n, plural, one {# item} other {# items}}',
          'Cuenta {n, plural, one {# objeto} other {# objetos}}',
        ),
      ].join('\n'),
    );
    const { failures } = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
    assert.ok(failures.some((f) => f.category === 'empty-target' && f.id === 'a.save'));
  }
});

test('an es target identical to the English text fails unless allowlisted', () => {
  const es = xliff(
    [
      unit('a.save', 'Save', 'Save'),
      unit(
        'a.hello',
        'Hello <x id="PH" equiv-text="profile.name"/>',
        'Hola <x id="PH" equiv-text="profile.name"/>',
      ),
      unit(
        'a.count',
        'Count {n, plural, one {# item} other {# items}}',
        'Cuenta {n, plural, one {# objeto} other {# objetos}}',
      ),
    ].join('\n'),
  );
  const blocked = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
  assert.ok(blocked.failures.some((f) => f.category === 'identical-target' && f.id === 'a.save'));

  const allowed = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: ['a.save'] });
  assert.deepEqual(allowed.failures, []);
  assert.equal(allowed.stats.identicalAllowed, 1);
});

test('the real allowlist has unique ids and a reason for every entry', () => {
  const ids = ALLOWED_IDENTICAL_IDS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of ALLOWED_IDENTICAL_IDS) assert.ok(entry.reason.trim().length > 0, entry.id);
});

test('a source that differs between catalogs fails', () => {
  const es = xliff(
    [
      unit('a.save', 'Save!', 'Guardar'),
      unit(
        'a.hello',
        'Hello <x id="PH" equiv-text="profile.name"/>',
        'Hola <x id="PH" equiv-text="profile.name"/>',
      ),
      unit(
        'a.count',
        'Count {n, plural, one {# item} other {# items}}',
        'Cuenta {n, plural, one {# objeto} other {# objetos}}',
      ),
    ].join('\n'),
  );
  const { failures } = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'source' && f.id === 'a.save'));
});

test('an empty source fails', () => {
  const en = xliff([unit('a.save', '')].join('\n'));
  const es = xliff([unit('a.save', '', 'Guardar')].join('\n'));
  const { failures } = checkLocaleParity({ en, es, allowedIdenticalIds: [] });
  assert.ok(
    failures.some((f) => f.category === 'source' && f.id === 'a.save' && /vac/.test(f.message)),
  );
});

test('a duplicated trans-unit id fails in its catalog', () => {
  const en = xliff([unit('a.save', 'Save'), unit('a.save', 'Save')].join('\n'));
  const { failures } = checkLocaleParity({ en, es: esCatalog(), allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'duplicate-id' && /a\.save/.test(f.message)));
  assert.throws(
    () => parseXliff(en),
    (error: unknown) => error instanceof XliffParseError && error.kind === 'duplicate',
  );
});

test('a placeholder marker that differs between en and es fails', () => {
  const es = xliff(
    [
      unit('a.save', 'Save', 'Guardar'),
      unit(
        'a.hello',
        'Hello <x id="PH" equiv-text="profile.name"/>',
        'Hola <x id="OTHER" equiv-text="profile.name"/>',
      ),
      unit(
        'a.count',
        'Count {n, plural, one {# item} other {# items}}',
        'Cuenta {n, plural, one {# objeto} other {# objetos}}',
      ),
    ].join('\n'),
  );
  const { failures } = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'placeholder' && f.id === 'a.hello'));
});

test('unbalanced ICU braces fail', () => {
  const es = xliff(
    [
      unit('a.save', 'Save', 'Guardar'),
      unit(
        'a.hello',
        'Hello <x id="PH" equiv-text="profile.name"/>',
        'Hola <x id="PH" equiv-text="profile.name"/>',
      ),
      unit(
        'a.count',
        'Count {n, plural, one {# item} other {# items}}',
        'Cuenta {n, plural, one {# objeto} other {# objetos}',
      ),
    ].join('\n'),
  );
  const { failures } = checkLocaleParity({ en: enCatalog(), es, allowedIdenticalIds: [] });
  assert.ok(failures.some((f) => f.category === 'icu-braces' && f.id === 'a.count'));
});

test('malformed XML is reported as a catalog failure', () => {
  const broken = enCatalog().replace('</trans-unit>', '</trans-unit');
  assert.deepEqual(categories(broken, esCatalog()), ['catalog']);
  assert.throws(
    () => parseXliff(broken),
    (error: unknown) => error instanceof XliffParseError && error.kind === 'malformed',
  );
  assert.throws(() => parseXliff('<xliff><file><body></file></xliff>'), XliffParseError);
});

test('a catalog without trans-units is reported as a catalog failure', () => {
  assert.deepEqual(categories(xliff(''), esCatalog()), ['catalog']);
  assert.throws(
    () => parseXliff(xliff('')),
    (error: unknown) => error instanceof XliffParseError && error.kind === 'empty',
  );
});

test('an allowlist entry that is no longer identical is reported as stale', () => {
  assert.deepEqual(categories(enCatalog(), esCatalog(), ['a.save']), ['allowlist']);
  assert.deepEqual(categories(enCatalog(), esCatalog(), ['missing.id']), ['allowlist']);
});

test('CLI passes on the real catalogs', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', script], {
    cwd: repo,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.match(output, /check:locale-parity OK/);
  assert.match(output, /messages\.en\.xlf \(290 unidades\)/);
  assert.match(output, /messages\.es\.xlf \(290 unidades\)/);
});

test('CLI exits 1 when --es points to a broken fixture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gd-locale-parity-'));
  try {
    const es = join(dir, 'messages.es.xlf');
    await writeFile(es, xliff(unit('a.save', 'Save', 'Save')));
    assert.throws(
      () =>
        execFileSync(process.execPath, ['--import', 'tsx', script, '--es', es], {
          cwd: repo,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 10_000,
        }),
      (error: { status?: number; stderr?: string }) =>
        error.status === 1 && /check:locale-parity FALLÓ/.test(String(error.stderr)),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
