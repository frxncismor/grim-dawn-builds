import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicBuild } from '@gd/domain';
import draftFixture from '../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import originalGuide from '../../../../../e2e/fixtures/original-guide.json';
import { LootFilter } from './loot-filter';

type LootFilterContent = Pick<
  PublicBuild,
  'slug' | 'title' | 'loot_filter_columns' | 'notes' | 'sections_meta'
>;
const content = draftFixture as unknown as LootFilterContent;
const original = originalGuide;

function installClipboard(value: Clipboard | undefined): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  };
}

describe('gd-loot-filter', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [LootFilter] }));
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  const render = async (value: LootFilterContent = content, sectionId = 'filtro-de-botin') => {
    const fixture = TestBed.createComponent(LootFilter);
    fixture.componentRef.setInput('content', value);
    fixture.componentRef.setInput('sectionId', sectionId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('preserves the four columns, all eight rules and their explicit action labels from the local guide', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const columns = Array.from(root.querySelectorAll<HTMLElement>('[data-column]'));

    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Loot filter');
    expect(columns).toHaveLength(4);
    expect(
      columns.map((column) => column.querySelector('[data-column-name]')?.textContent?.trim()),
    ).toEqual(content.loot_filter_columns.map((column) => column.name));
    expect(
      columns.map((column) => column.querySelector('.loot-column__subtitle')?.textContent?.trim()),
    ).toEqual(content.loot_filter_columns.map((column) => column.subtitle));
    expect(root.querySelectorAll('[data-rule]')).toHaveLength(8);
    expect(
      Array.from(root.querySelectorAll<HTMLElement>('[data-rule]')).map((rule) => ({
        action: rule.getAttribute('data-action'),
        label: rule.querySelector('[data-action-label]')?.textContent?.trim(),
      })),
    ).toEqual(
      content.loot_filter_columns.flatMap((column) =>
        column.rules.map((rule) => ({
          action: rule.action,
          label: { marcar: 'Mark', desmarcar: 'Unmark', aviso: 'Notice' }[rule.action],
        })),
      ),
    );
    expect(root.textContent).toContain('El filtro es un O, no un Y');
    expect(root.textContent).toContain('Cuantas más marques, menos filtra.');
    expect(
      content.loot_filter_columns.map((column) => ({
        name: column.name,
        subtitle: column.subtitle,
        rules: column.rules.map(({ label, detail }) => ({ label, detail })),
      })),
    ).toEqual(original.loot_columns);
    expect(content.notes.find((note) => note.position === 15)?.headline).toBe(
      original.loot_final.title,
    );
    expect(content.notes.find((note) => note.position === 15)?.detail).toBe(
      original.loot_final.body,
    );
  });

  it('renders the introduction and final tip from notes without the technical introduction marker', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const introduction = original.introductions.find((note) => note.section === 'Filtro de botín');
    const note = content.notes.find(
      (entry) =>
        entry.kind === 'general' && entry.label === 'Filtro de botín' && entry.position === 15,
    );

    expect(root.querySelector('[data-introduction]')?.textContent?.trim()).toBe(introduction?.text);
    expect(root.textContent).not.toContain('Introducción 1');
    expect(root.querySelector('[data-final-tip] [data-headline]')?.textContent?.trim()).toBe(
      note?.headline,
    );
    expect(root.querySelector('[data-final-tip] [data-detail]')?.textContent?.trim()).toBe(
      note?.detail,
    );
    expect(root.textContent).not.toContain('Representación esquemática sin verificar');
  });

  it('builds deterministic plain text in column and rule order, including notes and no markup', async () => {
    const fixture = await render();
    const component = fixture.componentInstance as unknown as { buildSummaryText(): string };
    const text = component.buildSummaryText();
    const introduction = content.notes.find(
      (note) => note.label === 'Filtro de botín' && /^Introducci[oó]n\s+\d+$/i.test(note.headline),
    )!;
    const finalTip = content.notes.find(
      (note) => note.label === 'Filtro de botín' && !/^Introducci[oó]n\s+\d+$/i.test(note.headline),
    )!;
    const expected = [
      'Loot filter',
      '',
      introduction.detail,
      '',
      ...content.loot_filter_columns.flatMap((column) => [
        `${column.name} — ${column.subtitle}`,
        ...column.rules.map(
          (rule) =>
            `- [${{ marcar: 'Mark', desmarcar: 'Unmark', aviso: 'Notice' }[rule.action]}] ${rule.label}: ${rule.detail}`,
        ),
        '',
      ]),
      `${finalTip.headline}: ${finalTip.detail}`,
    ].join('\n');

    expect(text).toBe(expected);
    expect(component.buildSummaryText()).toBe(text);
    expect(text).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(text).toContain('- [Notice] Ojo con la lógica: El filtro es un O, no un Y');
  });

  it('sorts copied columns and rules by position without mutating frozen input', async () => {
    const reversedColumns = Object.freeze(
      [...content.loot_filter_columns]
        .reverse()
        .map((column) =>
          Object.freeze({ ...column, rules: Object.freeze([...column.rules].reverse()) }),
        ),
    );
    const changed = { ...content, loot_filter_columns: reversedColumns } as LootFilterContent;
    const before = JSON.stringify(changed.loot_filter_columns);
    const fixture = await render(changed);
    const root = fixture.nativeElement as HTMLElement;

    expect(
      Array.from(root.querySelectorAll<HTMLElement>('[data-column] [data-column-name]')).map(
        (name) => name.textContent?.trim(),
      ),
    ).toEqual(content.loot_filter_columns.map((column) => column.name));
    expect(
      Array.from(root.querySelectorAll<HTMLElement>('[data-rule] [data-rule-label]')).map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(
      content.loot_filter_columns.flatMap((column) => column.rules.map((rule) => rule.label)),
    );
    expect(JSON.stringify(changed.loot_filter_columns)).toBe(before);
  });

  it('keeps every native details accordion open in SSR markup and supports native summary toggling', async () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const columns = root.querySelectorAll<HTMLDetailsElement>('details.loot-column');

    expect(columns).toHaveLength(4);
    expect(Array.from(columns).every((column) => column.open)).toBe(true);
    columns[0].open = false;
    expect(columns[0].open).toBe(false);
    expect(columns[0].querySelector('summary')?.tagName).toBe('SUMMARY');
    expect(root.querySelectorAll('[data-rule]')).toHaveLength(8);
  });

  it('respects visibility metadata for the configured and legacy section ids and defaults to visible', async () => {
    const hidden = {
      ...content,
      sections_meta: content.sections_meta.map((meta) =>
        meta.section_key === 'filtro-de-botin' ? { ...meta, visible: false } : meta,
      ),
    };
    const hiddenByLegacyId = await render(hidden, 'filtro');
    expect((hiddenByLegacyId.nativeElement as HTMLElement).querySelector('#filtro')).toBeNull();

    const withoutMetadata = {
      ...content,
      sections_meta: content.sections_meta.filter((meta) => meta.section_key !== 'filtro-de-botin'),
    };
    const visibleByDefault = await render(withoutMetadata);
    expect(
      (visibleByDefault.nativeElement as HTMLElement).querySelector('#filtro-de-botin'),
    ).not.toBeNull();
    const legacy = await render(content, 'filtro');
    expect((legacy.nativeElement as HTMLElement).querySelector('#filtro')).not.toBeNull();
  });

  it('shows an empty state and disables copy when there are no columns', async () => {
    const fixture = await render({ ...content, loot_filter_columns: [] });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No information available');
    expect(root.querySelector('[data-column]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[data-copy-summary]')?.disabled).toBe(true);
  });

  it('preserves duplicate-position data, warns accessibly and disables copy for duplicate columns or rules', async () => {
    const duplicateColumn = {
      ...content,
      loot_filter_columns: [
        content.loot_filter_columns[0],
        { ...content.loot_filter_columns[1], position: content.loot_filter_columns[0].position },
      ],
    } as LootFilterContent;
    const columnFixture = await render(duplicateColumn);
    const columnRoot = columnFixture.nativeElement as HTMLElement;
    expect(columnRoot.querySelectorAll('[data-column]')).toHaveLength(2);
    expect(columnRoot.querySelector('[data-inconsistent-data][role="alert"]')).not.toBeNull();
    expect(columnRoot.querySelector<HTMLButtonElement>('[data-copy-summary]')?.disabled).toBe(true);

    const duplicateRule = {
      ...content,
      loot_filter_columns: [
        {
          ...content.loot_filter_columns[0],
          rules: [
            content.loot_filter_columns[0].rules[0],
            { ...content.loot_filter_columns[0].rules[1], position: 1 },
          ],
        },
      ],
    } as LootFilterContent;
    const ruleFixture = await render(duplicateRule);
    const ruleRoot = ruleFixture.nativeElement as HTMLElement;
    expect(ruleRoot.querySelectorAll('[data-rule]')).toHaveLength(2);
    expect(ruleRoot.querySelector('[data-inconsistent-data][role="alert"]')).not.toBeNull();
    expect(ruleRoot.querySelector<HTMLButtonElement>('[data-copy-summary]')?.disabled).toBe(true);
  });

  it('escapes HTML-like editorial strings as text and isolates section IDs across instances', async () => {
    const hostile = {
      ...content,
      loot_filter_columns: [
        {
          ...content.loot_filter_columns[0],
          name: '<img src=x onerror=alert(1)>',
          rules: [
            {
              ...content.loot_filter_columns[0].rules[0],
              label: '<script>alert(1)</script>',
            },
          ],
        },
      ],
    } as LootFilterContent;
    const first = await render(content, 'filtro-primero');
    const second = await render(hostile, 'filtro-segundo');
    const host = document.createElement('div');
    host.append(first.nativeElement, second.nativeElement);
    const ids = Array.from(host.querySelectorAll<HTMLElement>('[id]')).map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(host.querySelector('img, script')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(host.textContent).toContain('<script>alert(1)</script>');
  });

  it('keeps clipboard disabled through SSR and explains the no-JavaScript fallback', async () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector<HTMLButtonElement>('[data-copy-summary]')?.disabled).toBe(true);
    expect(root.querySelector('[data-no-script]')?.textContent).toContain('JavaScript');
    expect(root.querySelector('[data-no-script]')?.textContent).toContain(
      'the full summary is already visible',
    );
    expect(root.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('copies the exact deterministic summary and announces success through the polite status region', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const restoreClipboard = installClipboard({ writeText } as unknown as Clipboard);
    try {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      const button = root.querySelector<HTMLButtonElement>('[data-copy-summary]')!;
      expect(button.disabled).toBe(false);
      button.focus();
      button.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(writeText).toHaveBeenCalledOnce();
      expect(writeText).toHaveBeenCalledWith(
        (fixture.componentInstance as unknown as { buildSummaryText(): string }).buildSummaryText(),
      );
      expect(root.querySelector('[role="status"]')?.textContent).toContain('copied');
      expect(root.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
      expect(document.activeElement).toBe(button);
    } finally {
      restoreClipboard();
    }
  });

  it('announces clipboard rejection and an unavailable clipboard without uncaught errors', async () => {
    const restoreRejectedClipboard = installClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')),
    } as unknown as Clipboard);
    try {
      const rejected = await render();
      const rejectedRoot = rejected.nativeElement as HTMLElement;
      rejectedRoot.querySelector<HTMLButtonElement>('[data-copy-summary]')?.click();
      await rejected.whenStable();
      rejected.detectChanges();
      expect(rejectedRoot.querySelector('[role="status"]')?.textContent).toMatch(
        /could not be copied|error/i,
      );
    } finally {
      restoreRejectedClipboard();
    }

    const restoreMissingClipboard = installClipboard(undefined);
    try {
      const missing = await render();
      const missingRoot = missing.nativeElement as HTMLElement;
      missingRoot.querySelector<HTMLButtonElement>('[data-copy-summary]')?.click();
      await missing.whenStable();
      missing.detectChanges();
      expect(missingRoot.querySelector('[role="status"]')?.textContent).toMatch(
        /is not available/i,
      );
    } finally {
      restoreMissingClipboard();
    }
  });
});
