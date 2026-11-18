import { ICONS, type IconName } from '../../shared/ui/icon/registry';

/** `ASSET_SOURCE`: which art the mastery index serves (constitution §VII, 1.10.0). */
export const ASSET_SOURCES = ['own', 'game'] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

/**
 * What the index shows for one mastery. `game` is the 197x41 button of the game, `own` the
 * project's own icon (32x32). The size is always the real one, so the `<img>` never shifts.
 */
export interface MasteryPortrait {
  readonly source: AssetSource;
  /** Relative to `<base href>`, like every other asset of the site. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** Own icon of each mastery, used when the manifest has no (usable) entry. */
const OWN_ICON: Readonly<Record<string, IconName>> = {
  arcanist: 'mastery-arcanista',
  demolition: 'mastery-demoledor',
  nightblade: 'mastery-filo-nocturno',
  occult: 'mastery-ocultista',
  shaman: 'mastery-chaman',
  soldier: 'mastery-soldado',
};

const ICON_SIZE = 32;

/** `ASSET_SOURCE` unset means `own`; any other value than `own|game` is an error. */
export function parseAssetSource(raw: string | undefined): AssetSource {
  if (raw === undefined) return 'own';
  if ((ASSET_SOURCES as readonly string[]).includes(raw)) return raw as AssetSource;
  throw new Error('ASSET_SOURCE debe ser own o game.');
}

/** The registered icon named by a manifest `fallback_svg` (`src/assets/icons/<id>.svg`), or null. */
export function iconFromFallback(fallbackSvg: string): IconName | null {
  const id = /^src\/assets\/icons\/([a-z0-9-]+)\.svg$/.exec(fallbackSvg)?.[1];
  return id && Object.hasOwn(ICONS, id) ? (id as IconName) : null;
}

export function ownPortrait(slug: string, icon?: IconName): MasteryPortrait {
  const id = icon ?? OWN_ICON[slug] ?? 'mastery-generic';
  return { source: 'own', src: `assets/icons/${id}.svg`, width: ICON_SIZE, height: ICON_SIZE };
}
