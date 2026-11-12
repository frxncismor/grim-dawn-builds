import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicBuild, TierEntry } from '@gd/domain';
import {
  ContentBadge,
  TierCard,
  ExternalAttribution,
  FilterChip,
  FilterBar,
  EmptyState,
} from './tier-components';
import { EMPTY_FILTER } from './filter';

const placeholder: TierEntry = {
  entry_kind: 'placeholder',
  combination_slug: 'chaman-demoledor',
  display_name: 'Chamán + Demoledor',
  build_slug: null,
  tier: 'sin_clasificar',
  content_status: 'placeholder',
  rights_status: 'own_original',
  review_state: 'publicado',
  external_url: null,
  external_author: null,
  source_slug: null,
  evaluated_on: null,
};
describe('controlled catalog components', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('renders an honest placeholder without a link or fabricated ranking', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TierCard);
    f.componentRef.setInput('entry', placeholder);
    f.componentRef.setInput('combinationName', 'Chamán + Demoledor');
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Guide coming soon');
    expect(f.nativeElement.textContent).toContain('Placeholder');
    expect(f.nativeElement.querySelector('a')).toBeNull();
    expect(f.nativeElement.querySelector('img').src).toContain(
      '/assets/icons/status-placeholder.svg',
    );
  });
  it('links only a matching public guide; a pending or mismatching guide has no href', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TierCard);
    f.componentRef.setInput('entry', {
      ...placeholder,
      entry_kind: 'build_propia',
      build_slug: 'own-guide',
      content_status: 'verificado',
    });
    f.componentRef.setInput('combinationName', 'Chamán');
    const guide = {
      slug: 'own-guide',
      title: 'Guía propia',
      review_state: 'publicado',
      rights_status: 'own_original',
    } as PublicBuild;
    f.componentRef.setInput('guide', guide);
    await f.whenStable();
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toBe('/builds/own-guide');
    f.componentRef.setInput('guide', { ...guide, rights_status: 'pending' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('a')).toBeNull();
    f.componentRef.setInput('guide', { ...guide, slug: 'different' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('a')).toBeNull();
  });
  it('link-only shows factual attribution and warning, with no guide body or image', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(TierCard);
    f.componentRef.setInput('combinationName', 'Chamán');
    f.componentRef.setInput('entry', {
      ...placeholder,
      entry_kind: 'enlace_externo',
      rights_status: 'link_only',
      content_status: 'sin_verificar',
      external_url: 'https://example.org/guide',
      external_author: 'Autora de prueba',
      source_slug: 'demo',
    });
    f.componentRef.setInput('source', {
      title: 'Fuente propia de prueba',
      license_note: 'Solo enlace',
    });
    await f.whenStable();
    const a = f.nativeElement.querySelector('a');
    expect(a.href).toBe('https://example.org/guide');
    expect(a.rel).toContain('noopener');
    expect(a.rel).toContain('noreferrer');
    expect(f.nativeElement.textContent).toContain('Autora de prueba');
    expect(f.nativeElement.textContent).toContain('Solo enlace');
    expect(f.nativeElement.textContent).toContain('third-party site');
    expect(f.nativeElement.querySelectorAll('img').length).toBe(1); // own status glyph only
    expect(f.nativeElement.querySelector('a[href^="/builds/"]')).toBeNull();
  });
  it('unsafe and credential-bearing external URLs remain text', async () => {
    const f = TestBed.createComponent(ExternalAttribution);
    const credentialUrl = new URL('https://example.org');
    credentialUrl.username = 'synthetic-user';
    credentialUrl.password = crypto.randomUUID();
    for (const url of [
      'javascript:alert(1)',
      '//example.org',
      credentialUrl.href,
      'data:text/html,hello',
    ]) {
      f.componentRef.setInput('url', url);
      f.componentRef.setInput('author', 'Autora');
      await f.whenStable();
      expect(f.nativeElement.querySelector('a')).toBeNull();
      expect(f.nativeElement.textContent).toContain('Autora');
    }
  });
  it('status always includes text and a decorative own icon', async () => {
    const f = TestBed.createComponent(ContentBadge);
    for (const [status, label] of [
      ['verificado', 'Verified'],
      ['sin_verificar', 'Unverified'],
      ['placeholder', 'Placeholder'],
    ]) {
      f.componentRef.setInput('status', status);
      await f.whenStable();
      expect(f.nativeElement.textContent).toContain(label);
      const icon = f.nativeElement.querySelector('img');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(icon?.getAttribute('alt')).toBe('');
      expect(icon?.getAttribute('src')).toContain(
        `assets/icons/status-${status.replace('_', '-')}.svg`,
      );
    }
  });
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
