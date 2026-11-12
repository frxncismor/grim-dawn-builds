import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import contentFixture from '../../../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import originalGuide from '../../../../../../../e2e/fixtures/original-guide.json';
import { BuildSections, type BuildSectionsContent } from './build-sections';

const fixture = contentFixture as unknown as BuildSectionsContent;
const original = originalGuide;

describe('gd-build-sections', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [BuildSections] }));
  afterEach(() => TestBed.resetTestingModule());

  const render = async (
    content: BuildSectionsContent,
    section: 'resumen' | 'prioridades' | 'notas' | 'guia-espiritual',
  ) => {
    const component = TestBed.createComponent(BuildSections);
    component.componentRef.setInput('content', content);
    component.componentRef.setInput('section', section);
    await component.whenStable();
    return component;
  };

  it('keeps the original header and callout copy with one paragraph per item', async () => {
    const view = await render(fixture, 'resumen');
    const root = view.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(original.header.title);
    expect(root.querySelector('[data-eyebrow]')?.textContent?.trim()).toBe(original.header.eyebrow);
    expect(root.querySelector('[data-subtitle]')?.textContent?.trim()).toBe(
      original.header.subtitle,
    );
    expect(root.querySelector('h2')?.textContent?.trim()).toBe(original.header.callout_title);
    expect(
      Array.from(root.querySelectorAll('[data-callout-body] p')).map((p) => p.textContent?.trim()),
    ).toEqual(original.header.callout_body);
    expect(root.querySelectorAll('h1')).toHaveLength(1);
  });

  it('renders all priorities in source order, preserving nullable ranks and source text', async () => {
    const view = await render(fixture, 'prioridades');
    const rows = Array.from(
      (view.nativeElement as HTMLElement).querySelectorAll('[data-priority]'),
    );
    expect(rows).toHaveLength(11);
    expect(rows.map((row) => row.querySelector('[data-group]')?.textContent?.trim())).toEqual(
      original.priorities.map((row) => row.label),
    );
    expect(rows.map((row) => row.querySelector('[data-headline]')?.textContent?.trim())).toEqual(
      original.priorities.map((row) => row.headline),
    );
    expect(rows.map((row) => row.querySelector('[data-detail]')?.textContent?.trim())).toEqual(
      original.priorities.map((row) => row.detail),
    );
    expect(
      rows.map((row) => row.querySelector('[data-rank]')?.textContent?.trim() ?? null),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', null, null]);
  });

  it('shows six typed notes, the omitted note, and unknown general notes while reserving future labels', async () => {
    const extended = {
      ...fixture,
      notes: [
        ...fixture.notes,
        {
          kind: 'general' as const,
          label: 'Nota nueva',
          headline: 'Dato',
          detail: 'Contenido',
          position: 40,
        },
      ],
    };
    const view = await render(extended, 'notas');
    const root = view.nativeElement as HTMLElement;
    const noteRows = Array.from(root.querySelectorAll('[data-note]'));
    const labels = noteRows.map((row) => row.querySelector('[data-label]')?.textContent?.trim());
    expect(labels).toEqual([
      'Devociones',
      'Nombres',
      'Atributos',
      'Arma',
      'Más adelante',
      'Rotación',
      'Omitir · Demoledor',
      'Nota nueva',
    ]);
    expect(
      noteRows.slice(0, 6).map((row) => ({
        label: row.querySelector('[data-label]')?.textContent?.trim(),
        headline: row.querySelector('[data-headline]')?.textContent?.trim(),
        detail: row.querySelector('[data-detail]')?.textContent?.trim(),
      })),
    ).toEqual(
      original.note_rows.map(({ label, headline, detail }) => ({ label, headline, detail })),
    );
    expect(noteRows[6].querySelector('[data-headline]')?.textContent?.trim()).toBe(
      original.omitted[0].title,
    );
    expect(noteRows[6].querySelector('[data-detail]')?.textContent?.trim()).toBe(
      original.omitted[0].detail,
    );
    for (const reserved of [
      'Orden real de compra',
      'Filtro de botín',
      'Ruta de devoción',
      'Esquemas de habilidades y devociones',
      'Referencias de devoción',
      'Qué tocar en cada árbol',
    ]) {
      expect(root.textContent).not.toContain(reserved);
    }
  });

  it('maps only the two editorial introductions and keeps the spiritual guide introduction with four locations and cost/warning', async () => {
    const withSecondIntroduction = {
      ...fixture,
      notes: [
        ...fixture.notes,
        {
          kind: 'general' as const,
          label: 'Qué subir ya mismo',
          headline: 'Introducción 2',
          detail: 'Segundo párrafo.',
          position: 19,
        },
      ],
    };
    const priorities = await render(withSecondIntroduction, 'prioridades');
    expect((priorities.nativeElement as HTMLElement).textContent).toContain(
      original.introductions.find((item) => item.section === 'Qué subir ya mismo')?.text,
    );
    expect((priorities.nativeElement as HTMLElement).textContent).toContain('Segundo párrafo.');
    expect((priorities.nativeElement as HTMLElement).textContent).not.toContain('Introducción 1');

    const guide = await render(fixture, 'guia-espiritual');
    const root = guide.nativeElement as HTMLElement;
    expect(root.textContent).toContain(
      original.introductions.find((item) => item.section === 'El Guía Espiritual')?.text,
    );
    const people = Array.from(root.querySelectorAll('[data-guide-person]'));
    expect(people).toHaveLength(4);
    expect(
      people.map((person) => ({
        group: person.querySelector('[data-group]')?.textContent?.trim(),
        name: person.querySelector('[data-name]')?.textContent?.trim(),
        location: person.querySelector('[data-location]')?.textContent?.trim(),
        detail: person.querySelector('[data-detail]')?.textContent?.trim(),
      })),
    ).toEqual(
      original.guide_rows.slice(0, 4).map((person) => {
        const [name, location] = person.headline.split(' — ');
        return { group: person.label, name, location, detail: person.detail };
      }),
    );
    const guideNotes = Array.from(root.querySelectorAll('[data-guide-note]'));
    expect(
      guideNotes.map((note) => ({
        label: note.querySelector('[data-label]')?.textContent?.trim(),
        headline: note.querySelector('[data-headline]')?.textContent?.trim(),
        detail: note.querySelector('[data-detail]')?.textContent?.trim(),
      })),
    ).toEqual(
      original.guide_rows.slice(4).map((note) => ({
        label: `Guía Espiritual · ${note.label}`,
        headline: note.headline,
        detail: note.detail,
      })),
    );
  });

  it('sorts notes and people by position on copies and keeps input arrays immutable', async () => {
    const unordered = {
      ...fixture,
      notes: [...fixture.notes].reverse(),
      guide_npcs: [...fixture.guide_npcs].reverse(),
    };
    const notesBefore = [...unordered.notes];
    const npcsBefore = [...unordered.guide_npcs];
    const notesView = await render(unordered, 'notas');
    const noteLabels = Array.from(
      (notesView.nativeElement as HTMLElement).querySelectorAll('[data-note] [data-label]'),
    ).map((node) => node.textContent?.trim());
    expect(noteLabels[0]).toBe('Devociones');
    expect(unordered.notes).toEqual(notesBefore);

    const guideView = await render(unordered, 'guia-espiritual');
    expect(
      Array.from(
        (guideView.nativeElement as HTMLElement).querySelectorAll(
          '[data-guide-person] [data-name]',
        ),
      ).map((node) => node.textContent?.trim()),
    ).toEqual(['Sahdina', 'Novi', 'Rena', 'Bagalla']);
    expect(unordered.guide_npcs).toEqual(npcsBefore);
  });

  it('accepts independently authored readonly content without relying on the imported guide slug', async () => {
    const synthetic = {
      eyebrow: 'Muestra independiente',
      title: 'Contenido sintético',
      subtitle: 'Sin slug ni datos del fixture editorial.',
      hero_callout_title: 'Prueba',
      hero_callout_body: Object.freeze(['Texto original de prueba.']),
      priorities: Object.freeze([
        Object.freeze({
          rank: null,
          group_label: 'Sin rango',
          headline: 'Prioridad propia',
          note: 'Detalle propio.',
          skill_node_slugs: [],
        }),
      ]),
      notes: Object.freeze([
        Object.freeze({
          kind: 'general' as const,
          label: 'Nota propia',
          headline: 'Titular propio',
          detail: 'Detalle propio.',
          position: 1,
        }),
      ]),
      guide_npcs: Object.freeze([
        Object.freeze({
          position: 1,
          group_label: 'Grupo propio',
          name: 'Nombre propio',
          location: 'Lugar propio',
          detail: 'Texto propio.',
        }),
      ]),
      sections_meta: Object.freeze([{ section_key: 'prioridades', position: 1, visible: true }]),
    } as unknown as BuildSectionsContent;
    const view = await render(synthetic, 'prioridades');
    expect((view.nativeElement as HTMLElement).textContent).toContain('Prioridad propia');
    expect((view.nativeElement as HTMLElement).textContent).toContain('Detalle propio.');
  });

  it('hides only when metadata explicitly marks the current section invisible', async () => {
    const hidden = {
      ...fixture,
      sections_meta: fixture.sections_meta.map((item) =>
        item.section_key === 'notas' ? { ...item, visible: false } : item,
      ),
    };
    const view = await render(hidden, 'notas');
    expect((view.nativeElement as HTMLElement).querySelector('#notas')).toBeNull();
    const absentMetadata = { ...fixture, sections_meta: [] };
    const visible = await render(absentMetadata, 'notas');
    expect((visible.nativeElement as HTMLElement).querySelector('#notas')).not.toBeNull();
  });

  it('shows localized empty states, omits empty callout paragraphs, and interpolates markup-like text safely', async () => {
    const empty = {
      ...fixture,
      hero_callout_body: [],
      priorities: [],
      notes: [],
      guide_npcs: [],
    };
    const summary = await render(empty, 'resumen');
    expect(
      (summary.nativeElement as HTMLElement).querySelector('[data-callout-body] p'),
    ).toBeNull();
    const priorities = await render(empty, 'prioridades');
    expect((priorities.nativeElement as HTMLElement).textContent).toContain(
      'No information available',
    );
    const notes = await render(empty, 'notas');
    expect((notes.nativeElement as HTMLElement).textContent).toContain('No information available');

    const hostile = {
      ...fixture,
      title: '<img src=x onerror=alert(1)>',
      priorities: [{ ...fixture.priorities[0], headline: '<em>texto</em>' }],
    };
    const escaped = await render(hostile, 'resumen');
    expect((escaped.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((escaped.nativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
      hostile.title,
    );
    const escapedPriority = await render(hostile, 'prioridades');
    expect((escapedPriority.nativeElement as HTMLElement).querySelector('em')).toBeNull();
    expect((escapedPriority.nativeElement as HTMLElement).textContent).toContain('<em>texto</em>');
  });
});
