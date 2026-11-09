import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER,
  applyFilter,
  parseFilter,
  serializeFilter,
  type CatalogItem,
  type TierFilter,
} from './filter';

const item = (overrides: Partial<CatalogItem> & { id: string }): CatalogItem => ({
  displayName: overrides.id,
  note: '',
  masteries: [],
  damageTypes: [],
  contentTags: [],
  playstyle: null,
  contentStatus: 'placeholder',
  tier: 'sin_clasificar',
  ...overrides,
});

const rayoChaman = item({
  id: 'rayo-chaman',
  displayName: 'Rayo + Chamán',
  masteries: ['chaman'],
  damageTypes: ['rayo'],
  contentStatus: 'sin_verificar',
  tier: 'A',
});
const fuegoChaman = item({
  id: 'fuego-chaman',
  displayName: 'Fuego + Chamán',
  masteries: ['chaman'],
  damageTypes: ['fuego'],
});
const rayoDemoledor = item({
  id: 'rayo-demoledor',
  displayName: 'Rayo + Demoledor',
  masteries: ['demoledor'],
  damageTypes: ['rayo'],
  contentTags: ['campana'],
  playstyle: 'rango',
});
const placeholderSlot = item({
  id: 'veneno-soldado',
  displayName: 'Veneno + Soldado',
  masteries: ['soldado'],
  damageTypes: ['veneno'],
  contentStatus: 'placeholder',
});

const catalog = [rayoChaman, fuegoChaman, rayoDemoledor, placeholderSlot];
const withFilter = (partial: Partial<TierFilter>): TierFilter => ({ ...EMPTY_FILTER, ...partial });

describe('applyFilter', () => {
  it('returns every item in input order when no filter is active', () => {
    expect(applyFilter(catalog, EMPTY_FILTER).map((i) => i.id)).toEqual([
      'rayo-chaman',
      'fuego-chaman',
      'rayo-demoledor',
      'veneno-soldado',
    ]);
  });

  it('combines groups with AND: Rayo and Chamán only keeps items matching both', () => {
    const result = applyFilter(
      catalog,
      withFilter({ masteries: ['chaman'], damageTypes: ['rayo'] }),
    );
    expect(result.map((i) => i.id)).toEqual(['rayo-chaman']);
  });

  it('combines values inside a group with OR', () => {
    const result = applyFilter(catalog, withFilter({ damageTypes: ['rayo', 'fuego'] }));
    expect(result.map((i) => i.id)).toEqual(['rayo-chaman', 'fuego-chaman', 'rayo-demoledor']);
  });

  it('matches Spanish text regardless of accents or case', () => {
    expect(applyFilter(catalog, withFilter({ text: 'CHAMAN' })).map((i) => i.id)).toEqual([
      'rayo-chaman',
      'fuego-chaman',
    ]);
  });

  it('matches text inside the note as well as the display name', () => {
    const noted = item({ id: 'nota', displayName: 'Build X', note: 'Rotación rápida' });
    expect(applyFilter([noted], withFilter({ text: 'rotacion' }))).toHaveLength(1);
  });

  it('requires every whitespace-separated text term to match', () => {
    expect(applyFilter(catalog, withFilter({ text: 'rayo chaman' })).map((i) => i.id)).toEqual([
      'rayo-chaman',
    ]);
  });

  it('filters by content status and hides other statuses', () => {
    expect(
      applyFilter(catalog, withFilter({ contentStatuses: ['sin_verificar'] })).map((i) => i.id),
    ).toEqual(['rayo-chaman']);
  });

  it('keeps placeholder slots visible when they match the other filters', () => {
    expect(applyFilter(catalog, withFilter({ masteries: ['soldado'] })).map((i) => i.id)).toEqual([
      'veneno-soldado',
    ]);
  });

  it('filters by playstyle and content tag', () => {
    expect(
      applyFilter(catalog, withFilter({ playstyles: ['rango'], contentTags: ['campana'] })).map(
        (i) => i.id,
      ),
    ).toEqual(['rayo-demoledor']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(applyFilter(catalog, withFilter({ text: 'inexistente' }))).toEqual([]);
  });

  it('does not mutate the input catalog', () => {
    const before = JSON.stringify(catalog);
    applyFilter(catalog, withFilter({ damageTypes: ['rayo'] }));
    expect(JSON.stringify(catalog)).toBe(before);
  });
});

describe('serializeFilter / parseFilter', () => {
  it('serializes an empty filter to an empty query string', () => {
    expect(serializeFilter(EMPTY_FILTER)).toBe('');
  });

  it('round-trips a filter through the URL query string', () => {
    const filter = withFilter({
      masteries: ['chaman', 'demoledor'],
      damageTypes: ['rayo'],
      contentStatuses: ['verificado', 'placeholder'],
      text: 'golpe primigenio',
    });
    expect(parseFilter(serializeFilter(filter))).toEqual(filter);
  });

  it('accepts a leading question mark when parsing', () => {
    expect(parseFilter('?d=rayo').damageTypes).toEqual(['rayo']);
  });

  it('sorts and de-duplicates values so equal filters serialize identically', () => {
    const a = serializeFilter(withFilter({ masteries: ['demoledor', 'chaman', 'chaman'] }));
    const b = serializeFilter(withFilter({ masteries: ['chaman', 'demoledor'] }));
    expect(a).toBe(b);
    expect(parseFilter(a).masteries).toEqual(['chaman', 'demoledor']);
  });

  it('ignores unknown content statuses and empty parameters', () => {
    const parsed = parseFilter('?s=inventado,verificado&m=&q=');
    expect(parsed.contentStatuses).toEqual(['verificado']);
    expect(parsed.masteries).toEqual([]);
    expect(parsed.text).toBe('');
  });
});
