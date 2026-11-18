import { describe, expect, it } from 'vitest';
import { MasteryTreeSchema } from './mastery-tree.js';
import type { MasteryTree } from './mastery-tree.js';
import { validateSkillNodeRefs } from './skill-node-refs.js';

const catalogNode = (id: string) => ({
  id,
  name: { en: 'Skill', es: 'Habilidad' },
  kind: 'active',
  circular: false,
  tier: 1,
  bar_required: 1,
  max_points: 16,
  grid: { col: 1, row: 1 },
  parent_id: null,
});
const tree = (id: string, slug: string, en: string, nodeId: string): MasteryTree =>
  MasteryTreeSchema.parse({
    mastery: { id, slug, name: { en, es: en } },
    game_version: '1.0',
    source: { game_version: '1.0', sha256: ['a'.repeat(64)] },
    nodes: [catalogNode(nodeId)],
  });

const catalog = [
  tree('class06', 'shaman', 'Shaman', 'class06/primal-strike'),
  tree('class02', 'demolition', 'Demolitionist', 'class02/blast-shell'),
];

// Guide slugs are editorial (`chaman`); the catalog follows the game (`shaman`).
const guide = (skill_node_id?: string) => ({
  masteries: [
    { slug: 'chaman', name_en: 'Shaman' },
    { slug: 'demoledor', name_en: 'Demolitionist' },
  ],
  skill_nodes: [
    { slug: 'golpe-primigenio', mastery_slug: 'chaman', skill_node_id },
    { slug: 'otro', mastery_slug: 'demoledor' },
  ],
});

describe('validateSkillNodeRefs (T016)', () => {
  it('pasa con una referencia válida de su maestría', () => {
    expect(validateSkillNodeRefs(guide('class06/primal-strike'), catalog)).toEqual([]);
  });

  it('no valida nada si ningún nodo declara skill_node_id, aunque el catálogo esté vacío', () => {
    expect(validateSkillNodeRefs(guide(), [])).toEqual([]);
  });

  it('falla con nodo y motivo si el id no existe en el catálogo', () => {
    const issues = validateSkillNodeRefs(guide('class06/no-existe'), catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(['skill_nodes', 0, 'skill_node_id']);
    expect(issues[0]!.message).toContain('golpe-primigenio');
    expect(issues[0]!.message).toContain('class06/no-existe');
    expect(issues[0]!.message).toMatch(/no existe en el catálogo/);
  });

  it('falla si el id pertenece a otra maestría que la del nodo', () => {
    const issues = validateSkillNodeRefs(guide('class02/blast-shell'), catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('golpe-primigenio');
    expect(issues[0]!.message).toMatch(/otra maestría/);
  });

  it('falla si la maestría del nodo no tiene árbol en el catálogo', () => {
    const issues = validateSkillNodeRefs(guide('class02/blast-shell'), [catalog[1]!]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/sin árbol en el catálogo/);
  });

  it('rechaza un skill_node_id repetido en la misma guía y nombra el primer nodo', () => {
    const dup = guide('class06/primal-strike');
    dup.skill_nodes.push({
      slug: 'repetido',
      mastery_slug: 'chaman',
      skill_node_id: 'class06/primal-strike',
    });
    const issues = validateSkillNodeRefs(dup, catalog);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(['skill_nodes', 2, 'skill_node_id']);
    expect(issues[0]!.message).toContain('repetido');
    expect(issues[0]!.message).toContain('golpe-primigenio');
    expect(issues[0]!.message).toMatch(/repetido|duplicado/);
  });
});
