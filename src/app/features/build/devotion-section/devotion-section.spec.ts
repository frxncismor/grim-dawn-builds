import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import draftFixture from '../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import originalGuide from '../../../../../e2e/fixtures/original-guide.json';
import { DevotionMap } from '../../../shared/svg/devotion-map/devotion-map';
import { DevotionSection, type DevotionSectionContent } from './devotion-section';

const content = draftFixture as unknown as DevotionSectionContent;
const original = originalGuide;

describe('gd-devotion-section', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DevotionSection] }));
  afterEach(() => TestBed.resetTestingModule());

  const render = async (
    value: DevotionSectionContent = content,
    options: { mapId?: string; sectionId?: string; active?: number } = {},
  ) => {
    const fixture = TestBed.createComponent(DevotionSection);
    fixture.componentRef.setInput('content', value);
    fixture.componentRef.setInput('mapId', options.mapId ?? 'devotion-map-test');
    fixture.componentRef.setInput('sectionId', options.sectionId ?? 'devociones');
    if (options.active !== undefined)
      fixture.componentRef.setInput('activeStepPosition', options.active);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('preserves the 11 source steps and their complete native map text without copying bodies or bindings into controls', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll('[data-step-position]'));
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('Ruta de devoción');
    expect(rows).toHaveLength(11);
    expect(rows.map((row) => Number(row.getAttribute('data-step-position')))).toEqual(
      content.devotion_steps.map((step) => step.position),
    );
    expect(rows.map((row) => row.getAttribute('data-verification'))).toEqual(
      content.devotion_steps.map((step) => step.verification),
    );
    for (const [index, step] of content.devotion_steps.entries()) {
      const matchingRows = rows.filter((row) => row.textContent?.includes(step.body));
      expect(matchingRows).toHaveLength(1);
      expect(matchingRows[0].textContent).toContain(original.devotion_steps[index].body);
      expect(matchingRows[0].textContent).toContain(original.devotion_steps[index].title);
    }
    const controls = root.querySelector('#devociones-selector')!;
    for (const step of content.devotion_steps) {
      expect(controls.textContent).not.toContain(step.body);
    }
    expect(
      Array.from(controls.querySelectorAll('button')).map((button) => ({
        position: button.querySelector('.step-selector__position')?.textContent?.trim(),
        label: button.querySelector('.step-selector__label')?.textContent?.trim(),
        title: button.querySelector('.step-selector__title')?.textContent?.trim() ?? null,
      })),
    ).toEqual(
      [...content.devotion_steps]
        .sort((left, right) => left.position - right.position)
        .map((step) => ({
          position: `${step.position}.`,
          label: step.label,
          title:
            step.title_override !== null && step.title_override !== step.label
              ? `· ${step.title_override}`
              : null,
        })),
    );
    const map = fixture.debugElement.query(By.directive(DevotionMap))
      .componentInstance as DevotionMap;
    expect(map.steps()).toEqual(content.devotion_steps);
    expect(map.constellations()).toEqual(content.constellations);
    expect(map.skillNodes()).toEqual(content.skill_nodes);
    expect(root.querySelectorAll('[data-list-constellation]')).toHaveLength(13);
    expect(root.querySelectorAll('p[data-binding-id]')).toHaveLength(5);
    expect(root.querySelectorAll('text[data-binding-id]')).toHaveLength(5);
    expect(root.textContent).toContain('verifica en GrimTools antes de gastar');
    expect(root.textContent).not.toContain('Introducción 1');
  });

  it('parses no editorial text into controls and preserves the three auxiliary notes in order', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const notes = Array.from(root.querySelectorAll('[data-devotion-note]'));
    const expected = content.notes
      .filter((note) =>
        ['Esquemas de habilidades y devociones', 'Referencias de devoción'].includes(note.label),
      )
      .sort((a, b) => a.position - b.position);
    expect(root.querySelectorAll('[data-introduction]')).toHaveLength(1);
    expect(root.querySelector('[data-introduction]')?.textContent?.trim()).toBe(
      content.notes.find((note) => note.label === 'Ruta de devoción')?.detail,
    );
    expect(
      notes.map((note) => ({
        label: note.querySelector('[data-label]')?.textContent?.trim(),
        headline: note.querySelector('[data-headline]')?.textContent?.trim(),
        detail: note.querySelector('[data-detail]')?.textContent?.trim(),
      })),
    ).toEqual(expected.map(({ label, headline, detail }) => ({ label, headline, detail })));
    expect(root.textContent).toContain(
      original.introductions.find((item) => item.section === 'Ruta de devoción')?.text,
    );
  });

  it('keeps the active position parent-controlled and emits exactly a selected editorial position', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const emitted: number[] = [];
    fixture.componentInstance.activeStepPositionChange.subscribe((position) =>
      emitted.push(position),
    );
    const buttons = root.querySelectorAll<HTMLButtonElement>('[data-select-position]');
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    buttons[3].focus();
    buttons[3].click();
    fixture.detectChanges();
    expect(emitted).toEqual([4]);
    expect(document.activeElement).toBe(buttons[3]);
    expect(buttons[3].getAttribute('aria-pressed')).toBe('false');
    fixture.componentRef.setInput('activeStepPosition', 4);
    fixture.detectChanges();
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true');
    const activeRow = root.querySelector<HTMLElement>(
      '[data-step-position="4"][data-active-step="true"]',
    );
    expect(activeRow).not.toBeNull();
    expect(activeRow?.textContent).toContain(
      content.devotion_steps.find((step) => step.position === 4)?.body,
    );
  });

  it('keeps neutral for undefined or unknown positions and supports a no-destination step', async () => {
    const neutral = await render(content, { active: 999 });
    const root = neutral.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-pressed="true"]')).toBeNull();
    expect(root.querySelector('[data-active-step="true"]')).toBeNull();
    const map = neutral.debugElement.query(By.directive(DevotionMap))
      .componentInstance as DevotionMap;
    expect(map.activeStepPosition()).toBeUndefined();
    const controls = root.querySelectorAll<HTMLButtonElement>('[data-select-position]');
    expect(controls[9].getAttribute('data-position')).toBe('10');
    expect(controls[10].getAttribute('data-position')).toBe('11');
    controls[9].click();
    expect(root.querySelector('[data-step-position="10"][data-active-step="true"]')).toBeNull();

    for (const position of [10, 11]) {
      neutral.componentRef.setInput('activeStepPosition', position);
      neutral.detectChanges();
      expect(
        root.querySelector(`[data-step-position="${position}"][data-active-step="true"]`),
      ).not.toBeNull();
      expect(root.querySelector('[data-constellation-id][data-active-step="true"]')).toBeNull();
    }
  });

  it('sorts a frozen copy by position, preserves ties and disables selection for duplicate positions', async () => {
    const steps = Object.freeze([
      Object.freeze({ ...content.devotion_steps[1], position: 6, label: 'Empate primero' }),
      Object.freeze({ ...content.devotion_steps[0], position: 6, label: 'Empate segundo' }),
      Object.freeze({ ...content.devotion_steps[2], position: 2, label: 'Antes' }),
    ]);
    const changed = { ...content, devotion_steps: steps } as unknown as DevotionSectionContent;
    const before = JSON.stringify(changed.devotion_steps);
    const fixture = await render(changed, { active: 6 });
    const root = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(root.querySelectorAll('[data-select-position]')).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual([
      expect.stringContaining('Antes'),
      expect.stringContaining('Empate primero'),
      expect.stringContaining('Empate segundo'),
    ]);
    expect(
      Array.from(root.querySelectorAll<HTMLButtonElement>('[data-select-position]')).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    expect(root.querySelector('[data-inconsistent-data]')?.textContent?.toLowerCase()).toContain(
      'inconsistentes',
    );
    expect(root.querySelector('[data-active-step="true"]')).toBeNull();
    const map = fixture.debugElement.query(By.directive(DevotionMap))
      .componentInstance as DevotionMap;
    expect(map.activeStepPosition()).toBeUndefined();
    expect(root.querySelectorAll('[data-step-position]')).toHaveLength(3);
    expect(JSON.stringify(changed.devotion_steps)).toBe(before);
  });

  it('respects section visibility and keeps an empty selector state while the map renders all its constellation data', async () => {
    const hidden = await render({
      ...content,
      sections_meta: content.sections_meta.map((meta) =>
        meta.section_key === 'devociones' ? { ...meta, visible: false } : meta,
      ),
    });
    expect((hidden.nativeElement as HTMLElement).querySelector('#devociones')).toBeNull();

    const withoutVisibilityMetadata = await render({
      ...content,
      sections_meta: content.sections_meta.filter((meta) => meta.section_key !== 'devociones'),
    });
    expect(
      (withoutVisibilityMetadata.nativeElement as HTMLElement).querySelector('#devociones'),
    ).not.toBeNull();

    const empty = await render({ ...content, devotion_steps: [] });
    const root = empty.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Sin información disponible');
    expect(root.querySelector('[data-select-position]')).toBeNull();
    expect(root.querySelectorAll('[data-list-constellation]')).toHaveLength(13);
    const map = empty.debugElement.query(By.directive(DevotionMap))
      .componentInstance as DevotionMap;
    expect(map.steps()).toEqual([]);
    expect(map.constellations()).toEqual(content.constellations);
  });

  it('keeps component instances and map IDs isolated and escapes labels', async () => {
    const first = await render(content, { mapId: 'map-primero', sectionId: 'devociones-primera' });
    const second = await render(content, { mapId: 'map-segundo', sectionId: 'devociones-segunda' });
    const host = document.createElement('div');
    host.append(first.nativeElement, second.nativeElement);
    const ids = Array.from(host.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const button of Array.from(
      host.querySelectorAll<HTMLButtonElement>('[data-select-position]'),
    )) {
      expect(host.querySelector(`[id="${button.getAttribute('aria-controls')}"]`)).not.toBeNull();
    }
    const hostile = await render({
      ...content,
      devotion_steps: [{ ...content.devotion_steps[0], label: '<img src=x onerror=alert(1)>' }],
    });
    expect((hostile.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((hostile.nativeElement as HTMLElement).textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('renders a title override only when it differs from the label', async () => {
    const changed = {
      ...content,
      devotion_steps: [
        {
          ...content.devotion_steps[0],
          label: 'Etiqueta compartida',
          title_override: 'Etiqueta compartida',
        },
        {
          ...content.devotion_steps[1],
          label: 'Etiqueta secundaria',
          title_override: 'Título alternativo',
        },
      ],
    } as DevotionSectionContent;
    const fixture = await render(changed);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[data-select-position]',
    );
    expect(buttons[0].textContent?.match(/Etiqueta compartida/g)).toHaveLength(1);
    expect(buttons[1].textContent).toContain('Etiqueta secundaria');
    expect(buttons[1].textContent).toContain('Título alternativo');
  });

  it('keeps step selection disabled until the browser render and does not access storage in SSR', async () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(root.querySelectorAll<HTMLButtonElement>('[data-select-position]')).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    expect(root.querySelector('[data-no-script]')?.textContent).toContain('JavaScript');
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-step-position]'));
    expect(rows).toHaveLength(11);
    for (const step of content.devotion_steps) {
      expect(rows.filter((row) => row.textContent?.includes(step.body))).toHaveLength(1);
    }
  });
});
