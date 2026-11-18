/** Path of the own skill-icon sprite (spec004 T024); same origin, so `img-src 'self'` covers it. */
export const SKILL_SPRITE_PATH = '/assets/ui/skill-icons.svg';
/** One `<symbol>` per skill type, plus the mastery glyph; the sprite defines each exactly once.
 * The circular marker has no symbol: it is a ring around the node (T045). */
export const SKILL_SYMBOLS = {
  active: 'skill-active',
  modifier: 'skill-modifier',
  transmuter: 'skill-transmuter',
  passive: 'skill-passive',
  mastery: 'skill-mastery',
} as const;
export type SkillSymbolId = (typeof SKILL_SYMBOLS)[keyof typeof SKILL_SYMBOLS];

/** The only fields of a catalog node that choose its own icon (never the game's texture name). */
export interface SkillIconNode {
  readonly kind: 'active' | 'passive' | 'modifier' | 'transmuter';
  readonly circular: boolean;
}

/** Own symbol of a node: always the one of its type (T045); `circular` is shown as a ring and as text. */
export function skillSymbol(node: SkillIconNode): SkillSymbolId {
  return SKILL_SYMBOLS[node.kind];
}

/** `href` for `<use>`; `'mastery'` is the glyph of a mastery (button fallback, index cards). */
export function skillSymbolHref(node: SkillIconNode | 'mastery'): string {
  const id = node === 'mastery' ? SKILL_SYMBOLS.mastery : skillSymbol(node);
  return `${SKILL_SPRITE_PATH}#${id}`;
}
