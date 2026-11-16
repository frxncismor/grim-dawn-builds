import { describe, expect, it } from 'vitest';
import type { CatalogInput } from '../tier-list/catalog.model';
import { input } from '../tier-list/catalog.test-data';
import { homeBuilds } from './home-builds';

const catalogInput = (over: Partial<CatalogInput> = {}): CatalogInput =>
  ({ ...input, ...over }) as unknown as CatalogInput;

describe('home builds (spec004 T016)', () => {
  it('features the latest public guide as a featured card linked to its guide', () => {
    const home = homeBuilds(catalogInput(), 'es');
    expect(home.featured?.variant).toBe('featured');
    expect(home.featured?.href).toEqual(['/builds', 'tormenta']);
    expect(home.featured?.masteries).toHaveLength(2);
    expect(home.featured?.status).toBe('verificado');
    expect(home.featured?.author).toBe('Autora');
    expect(home.featured?.damage).toEqual(['Lightning']);
  });

  it('has no featured card and no builds when no guide is public', () => {
    const empty = catalogInput({ guides: [] });
    const home = homeBuilds(empty, 'es');
    expect(home.featured).toBeNull();
    expect(home.others).toEqual([]);
  });

  it('never features a guide that is not public (review state or rights)', () => {
    const hidden = catalogInput({
      guides: [{ ...input.guides[0], review_state: 'borrador' }] as never,
    });
    const home = homeBuilds(hidden, 'es');
    expect(home.featured).toBeNull();
  });

  it('offers one access per mastery that opens the catalog already filtered', () => {
    const home = homeBuilds(catalogInput(), 'en');
    expect(home.masteries.map((m) => m.slug)).toEqual(['chaman', 'soldado', 'arcanista']);
    expect(home.masteries[0]).toMatchObject({ name: 'Shaman', query: { m: 'chaman' } });
  });

  it('counts the combinations that still have no guide, without listing them', () => {
    const home = homeBuilds(catalogInput(), 'es');
    expect(home.withoutGuide).toBe(1);
    expect(home.total).toBe(2);
  });

  it('puts the other public guides after the featured one, newest first', () => {
    const second = {
      ...input.guides[0],
      slug: 'otra',
      title: 'Otra',
      published_at: '2026-11-01',
    };
    const entries = [
      ...input.entries,
      { ...input.entries[0], combination_slug: 'chaman-arcanista', build_slug: 'otra' },
    ];
    const two = catalogInput({
      guides: [input.guides[0], second] as never,
      entries: entries as never,
    });
    const home = homeBuilds(two, 'es');
    expect(home.featured?.href).toEqual(['/builds', 'tormenta']);
    expect(home.others.map((c) => c.href?.[1])).toEqual(['otra']);
    expect(home.others[0]?.variant).toBe('standard');
  });

  it('dates the featured card with the guide it shows and keeps the ISO date', () => {
    expect(homeBuilds(catalogInput(), 'es').featuredDate).toBe('2026-11-09');
  });

  it('drops a date that is not a real calendar day', () => {
    for (const published_at of ['2026-02-30', '2026-13-01', '2026-11-9', '', null, 'hoy']) {
      const guides = [{ ...input.guides[0], published_at }] as never;
      expect(homeBuilds(catalogInput({ guides }), 'es').featuredDate).toBeNull();
    }
  });
});
