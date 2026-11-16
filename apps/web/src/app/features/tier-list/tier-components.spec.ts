import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FilterChip, FilterBar, EmptyState, TierRow } from './tier-components';
import { EMPTY_FILTER } from './filter';

describe('controlled catalog components', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('chip announces selection and honors native disabled', async () => {
    const f = TestBed.createComponent(FilterChip);
    f.componentRef.setInput('label', 'Rayo');
    f.componentRef.setInput('selected', true);
    let changes = 0;
    f.componentInstance.selectionToggle.subscribe(() => changes++);
    await f.whenStable();
    const button: HTMLButtonElement = f.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(changes).toBe(1);
    f.componentRef.setInput('disabled', true);
    await f.whenStable();
    button.click();
    expect(changes).toBe(1);
  });
  it('filter groups emit new state without mutating parent input, search and reset work', async () => {
    const f = TestBed.createComponent(FilterBar);
    const state = Object.freeze({ ...EMPTY_FILTER, damageTypes: Object.freeze(['rayo']) });
    f.componentRef.setInput('value', state);
    f.componentRef.setInput('groups', [
      {
        key: 'damageTypes',
        label: 'Daño',
        options: [
          { value: 'rayo', label: 'Rayo' },
          { value: 'fuego', label: 'Fuego' },
        ],
      },
    ]);
    const emitted: unknown[] = [];
    f.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    await f.whenStable();
    const buttons: HTMLButtonElement[] = [...f.nativeElement.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.trim() === 'Fuego')!.click();
    expect(emitted[0]).toEqual({ ...state, damageTypes: ['rayo', 'fuego'] });
    expect(state.damageTypes).toEqual(['rayo']);
    const input: HTMLInputElement = f.nativeElement.querySelector('input');
    input.value = 'Chamán';
    input.dispatchEvent(new Event('input'));
    expect(emitted[1]).toEqual({ ...state, text: 'Chamán' });
    buttons.find((b) => b.textContent?.trim() === 'Clear filters')!.click();
    expect(emitted[2]).toEqual(EMPTY_FILTER);
    expect(f.nativeElement.querySelector('legend').textContent).toBe('Daño');
    expect(input.labels?.length).toBe(1);
  });
  it('empty state provides a real recovery action', async () => {
    const f = TestBed.createComponent(EmptyState);
    let resets = 0;
    f.componentInstance.filtersReset.subscribe(() => resets++);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('No results');
    f.nativeElement.querySelector('button').click();
    expect(resets).toBe(1);
  });
});

describe('catalog component CSS is scoped to each host (spec005 T008, S4-D2)', () => {
  afterEach(() => TestBed.resetTestingModule());
  const css = readFileSync(resolve('src/styles/tier-components.css'), 'utf8');

  /** Every style-rule selector of the sheet, with state pseudo-classes removed so `matches` sees them. */
  const selectors: string[] = [];
  let buffer = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') {
      const prelude = buffer.trim();
      if (!prelude.startsWith('@'))
        selectors.push(
          ...prelude
            .split(/,(?![^(]*\))/)
            .map((sel) =>
              sel.replace(/:(hover|active|focus-visible|disabled|enabled)/g, '').trim(),
            ),
        );
      buffer = '';
    } else if (ch === '}' || ch === ';') buffer = '';
    else buffer += ch;
  }
  const reaches = (el: Element) => selectors.some((sel) => el.matches(sel));

  it('does not reach a gd-build-card projected into gd-tier-row', () => {
    const host = document.createElement('div');
    host.innerHTML = `<gd-tier-row><section><h2>Fila</h2><div class="catalog-grid">
      <gd-build-card><article class="build-card">
        <button class="chip" aria-pressed="true">Botón</button>
        <input type="search" /><fieldset><legend>Leyenda</legend><div class="chips"></div></fieldset>
        <div class="filters"><div class="search"></div></div><section class="empty"><button>Vacío</button></section>
      </article></gd-build-card></div></section></gd-tier-row>`;
    document.body.append(host);
    const card = host.querySelector('gd-build-card')!;
    expect(selectors.length).toBeGreaterThan(10);
    expect([card, ...card.querySelectorAll('*')].filter(reaches)).toEqual([]);
    expect(reaches(host.querySelector('.catalog-grid')!)).toBe(true);
    host.remove();
  });

  it('still reaches the elements each component renders itself', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    // TestBed mounts each component on a `div`; re-home its content under the real host tag.
    const own = async <T>(
      tag: string,
      type: new () => T,
      setup?: (f: ReturnType<typeof TestBed.createComponent<T>>) => void,
    ) => {
      const f = TestBed.createComponent(type);
      setup?.(f);
      await f.whenStable();
      const el = document.createElement(tag);
      el.append(...f.nativeElement.childNodes);
      host.append(el);
      return el;
    };
    const chip = await own('gd-filter-chip', FilterChip, (f) =>
      f.componentRef.setInput('label', 'Rayo'),
    );
    const bar = await own('gd-filter-bar', FilterBar);
    const empty = await own('gd-empty-state', EmptyState);
    const row = await own('gd-tier-row', TierRow, (f) => f.componentRef.setInput('label', 'S'));
    const owned = [
      chip.querySelector('button.chip'),
      bar.querySelector('input'),
      bar.querySelector('.filters > button'),
      empty.querySelector('button'),
      empty.querySelector('.empty'),
      row.querySelector('.catalog-grid'),
    ];
    expect(owned.map((el) => el?.outerHTML.slice(0, 40) ?? null).join('|')).not.toContain('null');
    expect(owned.filter((el) => !reaches(el!)).map((el) => el!.outerHTML.slice(0, 60))).toEqual([]);
    host.remove();
  });
});
