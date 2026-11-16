import { InjectionToken, makeStateKey } from '@angular/core';

/**
 * What the skill trees show for each node (spec004 T028, constitution 1.11.0 section VII). `null` is
 * the default `own`: the project's own symbol of the sprite (T024). With `game` the PNG derived from
 * the game is shown, except for the icons whose manifest entry is `withdrawn`, which keep the own
 * symbol.
 */
export interface SkillIconSource {
  readonly source: 'game';
  /** icon_id of the entries with `status: withdrawn`; sorted, usually empty. */
  readonly withdrawn: readonly string[];
}

/** Written by the server only when `ASSET_SOURCE=game`; read by every tree (also after hydration). */
export const SKILL_ICONS_STATE = makeStateKey<SkillIconSource | null>('gd-skill-icons');

/** Server-only provider; a rejection (invalid manifest, icon without entry) fails the prerender. */
export const SKILL_ICON_SOURCE = new InjectionToken<Promise<SkillIconSource | null>>(
  'SKILL_ICON_SOURCE',
);

/** Relative to `<base href>`, like every other asset of the site; named by its public id only. */
export function skillIconSrc(iconId: string): string {
  return `assets/skill-icons/${iconId}.png`;
}
