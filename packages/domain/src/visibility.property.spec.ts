import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { REVIEW_STATES, RIGHTS_STATUSES, APPROVED_RIGHTS } from './schema.js';
import type { Build } from './schema.js';
import { publicFilter } from './visibility.js';

/** Semilla base de las propiedades de dominio (T-140). Cada propiedad usa SEED + n. */
const SEED = 20261111;

const logProperty = (name: string, numRuns: number, seed: number, detail: string) =>
  console.info(`[property] ${name} numRuns=${numRuns} seed=${seed} ${detail}`);

type Flags = Pick<Build, 'review_state' | 'rights_status'>;

const flagsArb: fc.Arbitrary<Flags> = fc.record({
  review_state: fc.constantFrom(...REVIEW_STATES),
  rights_status: fc.constantFrom(...RIGHTS_STATUSES),
});

const listArb = fc.array(flagsArb, { maxLength: 40 });

describe('publicFilter properties', () => {
  it('es idempotente sobre listas arbitrarias de flags', () => {
    const name = 'publicFilter idempotente sobre listas';
    const numRuns = 150;
    const seed = SEED + 1;
    let cases = 0;
    let kept = 0;
    fc.assert(
      fc.property(fc.boolean(), listArb, (includeDrafts, xs) => {
        cases++;
        const f = publicFilter(includeDrafts);
        const once = xs.filter(f);
        const twice = once.filter(f);
        expect(twice).toEqual(once);
        expect(once.every(f)).toBe(true);
        kept += once.length;
      }),
      { numRuns, seed },
    );
    expect(kept).toBeGreaterThan(0);
    logProperty(name, numRuns, seed, `casos=${cases} elementos_conservados=${kept}`);
  });

  it('nunca deja salir borrador, en_revision, pending ni derechos no aprobados', () => {
    const name = 'publicFilter(false) solo deja publicado con derechos aprobados';
    const numRuns = 200;
    const seed = SEED + 2;
    let cases = 0;
    let visible = 0;
    let hidden = 0;
    fc.assert(
      fc.property(flagsArb, (build) => {
        cases++;
        if (publicFilter(false)(build)) {
          visible++;
          expect(build.review_state).toBe('publicado');
          expect(APPROVED_RIGHTS).toContain(build.rights_status);
          expect(['borrador', 'en_revision']).not.toContain(build.review_state);
          expect(build.rights_status).not.toBe('pending');
        } else {
          hidden++;
        }
      }),
      { numRuns, seed },
    );
    expect(visible).toBeGreaterThan(0);
    expect(hidden).toBeGreaterThan(0);
    logProperty(name, numRuns, seed, `casos=${cases} visibles=${visible} ocultos=${hidden}`);
  });

  it('con borradores incluidos es total: todo flag pasa', () => {
    const name = 'publicFilter(true) acepta cualquier flag';
    const numRuns = 150;
    const seed = SEED + 3;
    let cases = 0;
    fc.assert(
      fc.property(flagsArb, (build) => {
        cases++;
        expect(publicFilter(true)(build)).toBe(true);
      }),
      { numRuns, seed },
    );
    logProperty(name, numRuns, seed, `casos=${cases}`);
  });

  it('es monótono: lo público también pasa con borradores incluidos', () => {
    const name = 'publicFilter monótono (público ⊆ con borradores)';
    const numRuns = 200;
    const seed = SEED + 4;
    let cases = 0;
    let premise = 0;
    fc.assert(
      fc.property(flagsArb, (build) => {
        cases++;
        if (publicFilter(false)(build)) {
          premise++;
          expect(publicFilter(true)(build)).toBe(true);
        }
      }),
      { numRuns, seed },
    );
    expect(premise).toBeGreaterThan(0);
    logProperty(name, numRuns, seed, `casos=${cases} premisa_cumplida=${premise}`);
  });
});
