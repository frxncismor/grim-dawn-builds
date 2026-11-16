import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SKILL_KINDS } from '@gd/domain';
import {
  SKILL_SPRITE_PATH,
  SKILL_SYMBOLS,
  skillSymbol,
  skillSymbolHref,
  type SkillSymbolId,
} from './skill-symbols.ts';
import { resolveSkillIcon } from './resolve-icon.server.ts';

/**
 * spec004 T024 (fase a): own fallback icons for skill nodes. One sprite with a `<symbol>` per skill
 * type, referenced by `<use>`, defined once, with no emoji, no Unicode glyph and no game art
 * (SC-010, constitution VII exception 1: the own fallback must exist before any game icon ships).
 */
const root = join(import.meta.dirname, '../../../../../');
const spritePath = join(root, 'public', SKILL_SPRITE_PATH.replace(/^\//, ''));

test('the sprite declares exactly one symbol per own skill icon, each defined once', async () => {
  const svg = await readFile(spritePath, 'utf8');
  const ids = [...svg.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...ids].sort(), Object.values(SKILL_SYMBOLS).sort());
  assert.equal(new Set(ids).size, ids.length, 'duplicate symbol id');
  assert.deepEqual(Object.values(SKILL_SYMBOLS).sort(), [
    'skill-active',
    'skill-circular',
    'skill-mastery',
    'skill-modifier',
    'skill-passive',
    'skill-transmuter',
  ]);
});

test('every symbol is a fixed 24 x 24 passive drawing that takes its colour from currentColor', async () => {
  const svg = await readFile(spritePath, 'utf8');
  const symbols = svg.match(/<symbol\b[\s\S]*?<\/symbol>/g) ?? [];
  assert.equal(symbols.length, Object.keys(SKILL_SYMBOLS).length);
  for (const symbol of symbols) {
    assert.match(symbol, /viewBox="0 0 24 24"/);
    assert.match(symbol, /stroke="currentColor"/);
    assert.doesNotMatch(
      symbol,
      /#[0-9a-f]{3,8}\b/i,
      'hard-coded colour: use tokens via currentColor',
    );
  }
});

test('no emoji, Unicode glyph, text, embedded image, script or external reference', async () => {
  const svg = await readFile(spritePath, 'utf8');
  assert.doesNotMatch(svg, /[^\x00-\x7f]/, 'non-ASCII character');
  assert.doesNotMatch(
    svg,
    /<(?:text|tspan|image|script|foreignObject|style|filter|animate)\b|\bon\w+=|href\s*=|data:|url\(/i,
  );
  assert.doesNotMatch(svg, /maxroll|crate entertainment/i);
});

test('each skill kind, circular or not, resolves to an own symbol of the sprite', () => {
  for (const kind of SKILL_KINDS) {
    assert.equal(skillSymbol({ kind, circular: false }), SKILL_SYMBOLS[kind]);
    assert.equal(skillSymbol({ kind, circular: true }), SKILL_SYMBOLS.circular);
  }
  assert.equal(
    skillSymbolHref({ kind: 'passive', circular: false }),
    '/assets/ui/skill-icons.svg#skill-passive',
  );
  assert.equal(skillSymbolHref('mastery'), '/assets/ui/skill-icons.svg#skill-mastery');
});

test('the server resolver returns the own symbol and never a game path or a texture name', () => {
  const resolved = resolveSkillIcon({ kind: 'modifier', circular: false });
  assert.deepEqual(resolved, {
    source: 'own',
    symbol: 'skill-modifier' satisfies SkillSymbolId,
    href: '/assets/ui/skill-icons.svg#skill-modifier',
  });
  const withTexture = resolveSkillIcon({
    kind: 'active',
    circular: false,
    icon: 'ui/skills/icons/class01/skillicon_x.tex',
  } as never);
  assert.doesNotMatch(JSON.stringify(withTexture), /\.tex|ui\/skills/);
});
