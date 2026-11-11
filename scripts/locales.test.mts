import { test } from 'node:test';
import assert from 'node:assert/strict';
import { artifactLocales } from './locales.mts';

function project(i18n: unknown) {
  return { projects: { app: { i18n } } };
}

test('maps the source locale to the artifact root and every locale to its subPath', () => {
  assert.deepEqual(
    artifactLocales(
      project({
        sourceLocale: { code: 'en', subPath: '' },
        locales: { es: { translation: 'x.xlf', subPath: 'es' } },
      }),
    ),
    [
      { code: 'en', segments: [] },
      { code: 'es', segments: ['es'] },
    ],
  );
});

test('rejects a locale without its own subPath and duplicate artifact roots', () => {
  assert.throws(
    () =>
      artifactLocales(
        project({ sourceLocale: { code: 'en', subPath: '' }, locales: { es: { subPath: '' } } }),
      ),
    /subPath propio/,
  );
  assert.throws(
    () =>
      artifactLocales(
        project({
          sourceLocale: { code: 'en', subPath: '' },
          locales: { es: { subPath: 'es' }, fr: { subPath: 'es' } },
        }),
      ),
    /subPath de idioma duplicado/,
  );
});

test('rejects unsafe subPath segments instead of treating them as a locale directory', () => {
  for (const subPath of ['../es', '/es', 'es/../fr', 'ES']) {
    assert.throws(
      () =>
        artifactLocales(
          project({ sourceLocale: { code: 'en', subPath: '' }, locales: { es: { subPath } } }),
        ),
      /subPath de idioma no seguro/,
      subPath,
    );
  }
});

test('a project without i18n fails instead of silently using one locale', () => {
  assert.throws(() => artifactLocales({ projects: { app: {} } }), /ningún proyecto declara i18n/);
});
