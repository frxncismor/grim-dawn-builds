import { CONTENT_STATUSES } from '@gd/domain/vocabulary';
import type { ContentStatus, Tier } from '@gd/domain/vocabulary';

/** One catalog slot or build row, as the tier list needs it. Framework-independent. */
export interface CatalogItem {
  id: string;
  displayName: string;
  note: string;
  masteries: readonly string[];
  damageTypes: readonly string[];
  contentTags: readonly string[];
  playstyle: string | null;
  contentStatus: ContentStatus;
  tier: Tier;
}

/** Active filter. An empty group imposes no constraint. */
export interface TierFilter {
  masteries: readonly string[];
  damageTypes: readonly string[];
  contentTags: readonly string[];
  playstyles: readonly string[];
  contentStatuses: readonly ContentStatus[];
  text: string;
}

export const EMPTY_FILTER: TierFilter = {
  masteries: [],
  damageTypes: [],
  contentTags: [],
  playstyles: [],
  contentStatuses: [],
  text: '',
};

/** Lower-cases, strips diacritics and collapses whitespace so «Chamán» matches «chaman». */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Groups combine with AND; values inside one group combine with OR. */
function matchesGroup(values: readonly string[], selected: readonly string[]): boolean {
  return selected.length === 0 || selected.some((value) => values.includes(value));
}

function matchesText(item: CatalogItem, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = normalizeText(`${item.displayName} ${item.note}`);
  return terms.every((term) => haystack.includes(term));
}

/** Returns the items that satisfy every active group. Pure: the input is not modified. */
export function applyFilter(items: readonly CatalogItem[], filter: TierFilter): CatalogItem[] {
  const terms = normalizeText(filter.text).split(' ').filter(Boolean);
  return items.filter(
    (item) =>
      matchesGroup(item.masteries, filter.masteries) &&
      matchesGroup(item.damageTypes, filter.damageTypes) &&
      matchesGroup(item.contentTags, filter.contentTags) &&
      matchesGroup(item.playstyle ? [item.playstyle] : [], filter.playstyles) &&
      matchesGroup([item.contentStatus], filter.contentStatuses) &&
      matchesText(item, terms),
  );
}

const PARAM = {
  masteries: 'm',
  damageTypes: 'd',
  contentTags: 'c',
  playstyles: 'p',
  contentStatuses: 's',
  text: 'q',
} as const;

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** Canonical order for statuses follows CONTENT_STATUSES; unknown values are dropped. */
function canonicalStatuses(values: readonly string[]): ContentStatus[] {
  return CONTENT_STATUSES.filter((status) => values.includes(status));
}

/** Serializes the filter to a deterministic query string (no leading «?»). */
export function serializeFilter(filter: TierFilter): string {
  const params = new URLSearchParams();
  const groups = {
    [PARAM.masteries]: sortedUnique(filter.masteries),
    [PARAM.damageTypes]: sortedUnique(filter.damageTypes),
    [PARAM.contentTags]: sortedUnique(filter.contentTags),
    [PARAM.playstyles]: sortedUnique(filter.playstyles),
    [PARAM.contentStatuses]: canonicalStatuses(filter.contentStatuses),
  };
  for (const [key, values] of Object.entries(groups)) {
    if (values.length > 0) params.set(key, values.join(','));
  }
  const text = normalizeText(filter.text);
  if (text) params.set(PARAM.text, text);
  return params.toString();
}

/** Parses a query string (with or without a leading «?»). Missing or invalid values are ignored. */
export function parseFilter(query: string): TierFilter {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const list = (key: string): string[] =>
    (params.get(key) ?? '').split(',').filter((value) => value.length > 0);
  return {
    masteries: sortedUnique(list(PARAM.masteries)),
    damageTypes: sortedUnique(list(PARAM.damageTypes)),
    contentTags: sortedUnique(list(PARAM.contentTags)),
    playstyles: sortedUnique(list(PARAM.playstyles)),
    contentStatuses: canonicalStatuses(list(PARAM.contentStatuses)),
    text: normalizeText(params.get(PARAM.text) ?? ''),
  };
}
