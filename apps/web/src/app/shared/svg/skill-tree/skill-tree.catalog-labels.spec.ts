import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryTreeSchema, type MasteryTree } from '@gd/domain';
import arcanist from '../../../../../../../fixtures/content/mastery-trees/arcanist.json';
import demolition from '../../../../../../../fixtures/content/mastery-trees/demolition.json';
import nightblade from '../../../../../../../fixtures/content/mastery-trees/nightblade.json';
import occult from '../../../../../../../fixtures/content/mastery-trees/occult.json';
import shaman from '../../../../../../../fixtures/content/mastery-trees/shaman.json';
import soldier from '../../../../../../../fixtures/content/mastery-trees/soldier.json';
import { CATALOG_COLUMN_STEP, CATALOG_MIN_COLUMN_GAP, SkillTree } from './skill-tree';

const trees: readonly MasteryTree[] = [
  arcanist,
  demolition,
  nightblade,
  occult,
  shaman,
  soldier,
].map((raw) => MasteryTreeSchema.parse(raw));

/** Conservative advance widths at `--text-small` (12 px): Karla bold names, Space Mono meta. */
const NAME_CHAR_WIDTH = 8;
const META_CHAR_WIDTH = 7.4;

const xlf = readFileSync(resolve(process.cwd(), 'src/locale/messages.es.xlf'), 'utf8');
/** Spanish text of a message id, with `<x id="n"/>` placeholders replaced by `values[n]`. */
function spanish(id: string, values: Record<string, string> = {}): string {
  const start = xlf.indexOf(`<trans-unit id="${id}"`);
  const unit = xlf.slice(start, xlf.indexOf('</trans-unit>', start));
  const target = unit.match(/<target[^>]*>([\s\S]*?)<\/target>/)![1];
  return target
    .replace(/<x id="([^"]+)"[^>]*\/>/g, (_, name: string) => values[name] ?? name)
    .trim();
}

const KINDS = ['active', 'passive', 'modifier', 'transmuter'] as const;

describe('gd-skill-tree catalog labels vs column step (T012 polish)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(tree: MasteryTree, locale: string) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: locale }] });
    const fixture = TestBed.createComponent(SkillTree);
    fixture.componentRef.setInput('treeId', 'labels');
    fixture.componentRef.setInput('catalogTree', tree);
    await fixture.whenStable();
    return fixture;
  }

  for (const tree of trees)
    for (const locale of ['en', 'es'] as const) {
      it(`${tree.mastery.slug} (${locale}): no name/meta/circular line reaches the neighbour column`, async () => {
        const fixture = await render(tree, locale);
        const root: HTMLElement = fixture.nativeElement;
        const limit = CATALOG_COLUMN_STEP - CATALOG_MIN_COLUMN_GAP;
        for (const node of root.querySelectorAll('[data-skill-id]')) {
          const id = node.getAttribute('data-skill-id');
          for (const line of node.querySelectorAll('.skill-tree__name tspan'))
            expect(
              line.textContent!.trim().length * NAME_CHAR_WIDTH,
              `${id} name`,
            ).toBeLessThanOrEqual(limit);
          for (const line of node.querySelectorAll('.skill-tree__bar-required tspan'))
            expect(
              line.textContent!.trim().length * META_CHAR_WIDTH,
              `${id} meta`,
            ).toBeLessThanOrEqual(limit);
        }
      });
    }

  it('the longest possible Spanish and English meta lines also fit (kinds, max/ultimate, circular)', () => {
    const lines = [
      ...['Active', 'Passive', 'Modifier', 'Transmuter', 'Max 16 (26)', 'Circular'],
      ...[
        'skillTree.kind.active',
        'skillTree.kind.passive',
        'skillTree.kind.modifier',
        'skillTree.kind.transmuter',
      ].map((id) => spanish(id)),
      spanish('skillTree.catalogMaxUltimate', { max: '16', ultimate: '26' }),
      spanish('skillTree.catalogMax', { max: '16' }),
      spanish('skillTree.circular'),
    ];
    expect(KINDS).toHaveLength(4);
    for (const line of lines)
      expect(line.length * META_CHAR_WIDTH, line).toBeLessThanOrEqual(
        CATALOG_COLUMN_STEP - CATALOG_MIN_COLUMN_GAP,
      );
  });
});
