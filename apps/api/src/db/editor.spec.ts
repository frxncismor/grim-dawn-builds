import { describe, expect, it, vi } from 'vitest';
import { contractDoc } from '@gd/domain/testing';
import { prepareEdit, runEditor, editData } from './editor.mjs';

const input = () => ({ document: contractDoc('editor-guide') });

describe('editor canonical input before I/O', () => {
  it('accepts a full pending draft while preserving private editorial fields', () => {
    const raw = input();
    const result = prepareEdit('build', 'editor-guide', raw);
    expect(result.document).toEqual(raw.document);
    expect(result.createMissingDependencies).toBe(false);
  });
  it('refuses invalid targets, private error excerpts and publication without explicit proof', () => {
    for (const [kind, slug, raw] of [
      ['build', 'another', input()],
      ['unknown', 'editor-guide', input()],
      ['build', 'editor-guide', { ...input(), builds: [] }],
      ['build', 'editor-guide', { document: { ...input().document, review_state: 'publicado' } }],
      ['build', 'editor-guide', { document: { ...input().document, source_slugs: [] } }],
      [
        'build',
        'editor-guide',
        {
          document: {
            ...input().document,
            author_slug: 'por-confirmar',
            review_state: 'publicado',
          },
        },
      ],
    ])
      expect(() => prepareEdit(kind as string, slug as string, raw)).toThrow(/editor/);
  });
  it('does not let unrelated resources ride along with a target edit', () => {
    expect(() =>
      prepareEdit('build', 'editor-guide', {
        ...input(),
        dependencies: { authors: [{ ...input().document.author, slug: 'unrelated' }] },
      }),
    ).toThrow();
    expect(() =>
      prepareEdit('build', 'editor-guide', {
        ...input(),
        dependencies: { sources: [{ ...input().document.sources[0], title: 'conflict' }] },
      }),
    ).toThrow();
  });
});

describe('editor lifecycle boundaries', () => {
  it('rejects nonlocal environments before filesystem, credentials or client I/O', async () => {
    const read = vi.fn();
    const createClient = vi.fn();
    const err = vi.fn();
    for (const APP_ENV of [undefined, 'production', 'staging'])
      expect(
        await runEditor(
          { APP_ENV },
          ['--kind', 'build', '--slug', 'editor-guide', '--file', 'input.json'],
          { read, createClient, write: { out: vi.fn(), err } },
        ),
      ).toBe(1);
    expect(read).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
  it('validates JSON before opening a connection or loading credentials', async () => {
    const createClient = vi.fn();
    const err = vi.fn();
    const result = await runEditor(
      { APP_ENV: 'test' },
      ['--kind', 'build', '--slug', 'editor-guide', '--file', 'input.json'],
      {
        read: async () => ({ document: { title: 'PRIVATE-CANARY' } }),
        createClient,
        write: { out: vi.fn(), err },
      },
    );
    expect(result).toBe(1);
    expect(createClient).not.toHaveBeenCalled();
    expect(JSON.stringify(err.mock.calls)).not.toContain('PRIVATE-CANARY');
  });
  it('checks the actual editor role and rolls back without using bootstrap or role DDL', async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.includes('pg_roles') ? [{ role: 'importer', privileged: false }] : [],
    }));
    await expect(
      editData({ query }, prepareEdit('build', 'editor-guide', input())),
    ).rejects.toThrow();
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(
      expect.arrayContaining(['BEGIN', 'ROLLBACK']),
    );
    expect(
      query.mock.calls.some(([sql]) => /content_origin|ALTER ROLE|SET ROLE|CREATE TABLE/.test(sql)),
    ).toBe(false);
  });
});
