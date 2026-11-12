import { describe, expect, it } from 'vitest';
import type { Build } from './schema.js';
import { publicFilter } from './visibility.js';

const build = (
  overrides: Partial<Pick<Build, 'review_state' | 'rights_status'>>,
): Pick<Build, 'review_state' | 'rights_status'> => ({
  review_state: 'publicado',
  rights_status: 'licensed',
  ...overrides,
});

describe('publicFilter', () => {
  it('lets publicado builds with approved rights through', () => {
    const visible = publicFilter(false);
    expect(visible(build({ review_state: 'publicado', rights_status: 'own_original' }))).toBe(true);
    expect(visible(build({ review_state: 'publicado', rights_status: 'licensed' }))).toBe(true);
    expect(visible(build({ review_state: 'publicado', rights_status: 'permission_granted' }))).toBe(
      true,
    );
    expect(visible(build({ review_state: 'publicado', rights_status: 'link_only' }))).toBe(true);
  });

  it('hides borrador and en_revision builds', () => {
    const visible = publicFilter(false);
    expect(visible(build({ review_state: 'borrador', rights_status: 'licensed' }))).toBe(false);
    expect(visible(build({ review_state: 'en_revision', rights_status: 'licensed' }))).toBe(false);
  });

  it('hides publicado builds whose rights are still pending', () => {
    const visible = publicFilter(false);
    expect(visible(build({ review_state: 'publicado', rights_status: 'pending' }))).toBe(false);
  });

  it('lets every build through only when drafts are explicitly included', () => {
    const visible = publicFilter(true);
    expect(visible(build({ review_state: 'borrador', rights_status: 'pending' }))).toBe(true);
    expect(visible(build({ review_state: 'publicado', rights_status: 'pending' }))).toBe(true);
  });
});
