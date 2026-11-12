import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import draftFixture from '../../../../../../../content/builds/chaman-demoledor-golpe-primigenio.json';
import { progressKey, progressRevision } from './progress';
import { PurchaseStepper, type PurchaseStepperContent } from './purchase-stepper';

const content = draftFixture as unknown as PurchaseStepperContent;
const key = progressKey(content.slug);

function installStorage(storageGetter: () => Storage): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { configurable: true, get: storageGetter });
  return () => {
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    else Reflect.deleteProperty(window, 'localStorage');
  };
}

describe('gd-purchase-stepper', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PurchaseStepper] });
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(progressKey('otra-guia'));
  });
  afterEach(() => {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(progressKey('otra-guia'));
    TestBed.resetTestingModule();
  });

  const render = async (value: PurchaseStepperContent = content) => {
    const fixture = TestBed.createComponent(PurchaseStepper);
    fixture.componentRef.setInput('content', value);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('renders all six steps and the content introduction in SSR-readable text', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll('[data-step]'));
    expect(root.querySelector('#orden h2')?.textContent?.trim()).toBe('Real purchase order');
    expect(root.textContent).toContain(
      content.notes.find((note) => note.label === 'Orden real de compra')?.detail,
    );
    expect(rows.map((row) => row.querySelector('[data-threshold]')?.textContent?.trim())).toEqual(
      content.purchase_steps.map((step) => step.threshold_label),
    );
    expect(rows.map((row) => row.querySelector('[data-title]')?.textContent?.trim())).toEqual(
      content.purchase_steps.map((step) => step.title),
    );
    expect(rows.map((row) => row.querySelector('[data-body]')?.textContent?.trim())).toEqual(
      content.purchase_steps.map((step) => step.body),
    );
    expect(rows[0].querySelectorAll('[data-highlight]')).toHaveLength(2);
    expect(root.textContent).not.toContain('Introducción 1');
    expect(root.querySelector('[role="tab"]')).toBeNull();
  });

  it('selects by position, emits existing highlight ids in editorial order without changing the tree selection contract', async () => {
    const fixture = await render();
    const emitted: unknown[] = [];
    fixture.componentInstance.selectionChange.subscribe((value) => emitted.push(value));
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[data-select-step]',
    );
    buttons[0].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(emitted.at(-1)).toEqual({
      position: 1,
      activeIds: ['golpe-atronador', 'viento-demoniaco'],
    });
    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
    expect(emitted.at(-1)).toEqual({ position: 2, activeIds: ['torrente'] });
    buttons[5].click();
    fixture.detectChanges();
    expect(emitted.at(-1)).toEqual({
      position: 6,
      activeIds: ['pacto-de-clamatormentas', 'escudo-explosivo', 'mina-de-termita'],
    });
  });

  it('shows zero and null points distinctly and retains English labels for known highlights', async () => {
    const modified = {
      ...content,
      purchase_steps: [
        {
          ...content.purchase_steps[0],
          position: 4,
          highlights: [{ skill_node_slug: 'golpe-atronador', points: 0 }],
        },
        {
          ...content.purchase_steps[1],
          position: 9,
          highlights: [{ skill_node_slug: 'torrente', points: null }],
        },
      ],
    };
    const fixture = await render(modified);
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-step]'));
    expect(rows[0].querySelector('[data-highlight] .points')?.textContent).toContain('0 points');
    expect(rows[0].textContent).toContain('Thunderous Strike');
    expect(rows[0].textContent).toContain('Golpe Atronador (Thunderous Strike)');
    expect(rows.map((row) => (row as HTMLLIElement).value)).toEqual([4, 9]);
    expect(rows[1].querySelector('[data-highlight] .points')?.textContent).toContain(
      'No point value',
    );
    expect(rows[1].textContent).toContain('Torrent');
  });

  it('orders a copy by position, preserves tie order, and disables controls when positions collide', async () => {
    const duplicate = {
      ...content,
      purchase_steps: [
        { ...content.purchase_steps[1], position: 7, title: 'Empate A' },
        { ...content.purchase_steps[0], position: 7, title: 'Empate B' },
      ],
    };
    const fixture = await render(duplicate);
    const root = fixture.nativeElement as HTMLElement;
    expect(
      Array.from(root.querySelectorAll('[data-title]')).map((node) => node.textContent?.trim()),
    ).toEqual(['Empate A', 'Empate B']);
    expect(root.textContent?.toLowerCase()).toContain('inconsistent');
    expect(
      Array.from(root.querySelectorAll('button,input')).every(
        (item) => (item as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('uses non-contiguous editorial positions as selection identity and emits no unknown skill ids', async () => {
    const nonContiguous = {
      ...content,
      purchase_steps: [
        { ...content.purchase_steps[0], position: 20 },
        { ...content.purchase_steps[1], position: 4 },
      ],
    };
    const fixture = await render(nonContiguous);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[data-select-step]',
    );
    expect(buttons[0].getAttribute('data-position')).toBe('4');
    const emitted: unknown[] = [];
    fixture.componentInstance.selectionChange.subscribe((event) => emitted.push(event));
    buttons[1].click();
    expect(emitted.at(-1)).toEqual({
      position: 20,
      activeIds: ['golpe-atronador', 'viento-demoniaco'],
    });

    const unknown = await render({
      ...content,
      skill_nodes: [],
      purchase_steps: [
        {
          ...content.purchase_steps[0],
          highlights: [{ skill_node_slug: 'not-present', points: 3 }],
        },
      ],
    });
    const unknownEmissions: unknown[] = [];
    unknown.componentInstance.selectionChange.subscribe((event) => unknownEmissions.push(event));
    (unknown.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-select-step]')!
      .click();
    expect(unknownEmissions.at(-1)).toEqual({ position: 1, activeIds: [] });
    expect(
      (unknown.nativeElement as HTMLElement).querySelector('a[href*="not-present"]'),
    ).toBeNull();
  });

  it('does not mutate frozen arrays, honors visibility, renders empty state, and escapes editor text', async () => {
    const frozen = {
      ...content,
      purchase_steps: Object.freeze(
        content.purchase_steps.map((step) => Object.freeze({ ...step })),
      ),
      sections_meta: content.sections_meta.filter((item) => item.section_key !== 'orden'),
    } as unknown as PurchaseStepperContent;
    const visible = await render(frozen);
    expect(visible.nativeElement.querySelector('#orden')).not.toBeNull();

    const hidden = await render({
      ...content,
      sections_meta: content.sections_meta.map((item) =>
        item.section_key === 'orden' ? { ...item, visible: false } : item,
      ),
    });
    expect(hidden.nativeElement.querySelector('#orden')).toBeNull();

    const empty = await render({ ...content, purchase_steps: [] });
    expect(empty.nativeElement.textContent).toContain('No information available');
    expect(
      empty.nativeElement.querySelector('[data-select-step],input[type="checkbox"]'),
    ).toBeNull();

    const hostile = await render({
      ...content,
      purchase_steps: [{ ...content.purchase_steps[0], title: '<img src=x onerror=alert(1)>' }],
    });
    expect(hostile.nativeElement.querySelector('img')).toBeNull();
    expect(hostile.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('keeps step selection separate from completion and enables persistence only after explicit opt-in', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const checkboxes = root.querySelectorAll<HTMLInputElement>('[data-completed]');
    const selection = root.querySelector<HTMLButtonElement>('[data-select-step]')!;
    expect(fixture.componentInstance.browserReady()).toBe(true);
    selection.click();
    fixture.detectChanges();
    expect(selection.getAttribute('aria-pressed')).toBe('true');
    checkboxes[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('[data-completed-label="1"]')?.textContent).toContain('Completed');
    expect(root.querySelector('[data-select-step]')?.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(key)).toBeNull();

    root.querySelector<HTMLInputElement>('[data-persist]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const payload = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    expect(payload.completed).toEqual([1]);
    expect(Object.keys(payload).sort()).toEqual(['completed', 'revision', 'version']);
  });

  it('restores an opted-in checklist, clears it without changing selection, and removes only the guide key', async () => {
    const first = await render();
    (first.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-persist]')!.click();
    await first.whenStable();
    first.detectChanges();
    (first.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('[data-completed]')!
      .click();
    await first.whenStable();
    first.detectChanges();
    (first.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-select-step]')!
      .click();
    await first.whenStable();
    first.detectChanges();
    const neighborKey = progressKey('otra-guia');
    window.localStorage.setItem(neighborKey, 'preservar');

    const restored = await render();
    expect(
      (restored.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(true);
    const selection = (restored.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-select-step]',
    )!;
    selection.click();
    restored.detectChanges();
    (restored.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-clear-progress]')!
      .click();
    await restored.whenStable();
    expect(
      (restored.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(false);
    expect(selection.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(neighborKey)).toBe('preservar');
    expect(
      (restored.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-persist]')
        ?.checked,
    ).toBe(true);
  });

  it('ignores corrupted storage and keeps memory-only operation when localStorage getter or writes are denied', async () => {
    window.localStorage.setItem(key, '{');
    const corrupt = await render();
    expect(
      (corrupt.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(false);

    const restoreStorage = installStorage(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    try {
      const denied = await render();
      expect(
        (denied.nativeElement as HTMLElement).querySelector('[data-storage-message]')?.textContent,
      ).toContain('not available');
      expect(
        (denied.nativeElement as HTMLElement).querySelector('[data-select-step]'),
      ).not.toBeNull();
    } finally {
      restoreStorage();
    }
  });

  it('survives denied reads and writes without losing checklist state or logging payloads', async () => {
    const deniedStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('Denied read', 'SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new DOMException('Denied write', 'SecurityError');
      }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    const restoreStorage = installStorage(() => deniedStorage);
    try {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-storage-message]')?.textContent).toContain('not available');
      root.querySelector<HTMLInputElement>('[data-completed]')!.click();
      root.querySelector<HTMLInputElement>('[data-persist]')!.click();
      await fixture.whenStable();
      expect(deniedStorage.setItem).toHaveBeenCalledOnce();
      expect(root.querySelector('[data-completed-label="1"]')?.textContent).toContain('Completed');
      expect(root.textContent).toContain('Saving is not available');
    } finally {
      restoreStorage();
    }
  });

  it('reports failed removal accurately when opting out or clearing a checklist', async () => {
    const deniedStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new DOMException('Denied remove', 'SecurityError');
      }),
    } as unknown as Storage;
    const restoreStorage = installStorage(() => deniedStorage);
    try {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLInputElement>('[data-completed]')!.click();
      root.querySelector<HTMLButtonElement>('[data-clear-progress]')!.click();
      fixture.detectChanges();
      expect(root.querySelector<HTMLInputElement>('[data-persist]')?.checked).toBe(false);
      expect(root.querySelector('[data-storage-message]')?.textContent).toContain(
        'only cleared in this view',
      );
      expect(deniedStorage.removeItem).toHaveBeenCalledOnce();

      root.querySelector<HTMLInputElement>('[data-persist]')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      root.querySelector<HTMLInputElement>('[data-persist]')!.click();
      fixture.detectChanges();
      expect(root.querySelector('[data-storage-message]')?.textContent).toContain(
        'could not be removed from the browser',
      );
      expect(deniedStorage.removeItem).toHaveBeenCalledTimes(2);
    } finally {
      restoreStorage();
    }
  });

  it('resets selection and completion when guide or revision changes without saving old state under the new identity', async () => {
    const fixture = await render();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('[data-persist]')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLInputElement>('[data-completed]')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-select-step]')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    const emissions: unknown[] = [];
    fixture.componentInstance.selectionChange.subscribe((event) => emissions.push(event));

    const nextGuide = { ...content, slug: 'otra-guia' };
    fixture.componentRef.setInput('content', nextGuide);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-select-step]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(false);
    expect(emissions.at(-1)).toEqual({ position: null, activeIds: [] });
    expect(window.localStorage.getItem(progressKey('otra-guia'))).toBeNull();

    fixture.componentRef.setInput('content', { ...nextGuide, game_version: 'revisión nueva' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(false);
  });

  it('ignores stale revision data for the same guide without overwriting its stored value', async () => {
    const oldRevision = progressRevision('versión anterior', content.purchase_steps);
    const stale = JSON.stringify({ version: 1, revision: oldRevision, completed: [1] });
    window.localStorage.setItem(key, stale);
    const newer = await render({ ...content, game_version: 'versión actualizada' });
    expect(
      (newer.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-completed]')
        ?.checked,
    ).toBe(false);
    expect(window.localStorage.getItem(key)).toBe(stale);
  });

  it('does not touch storage when rendered with the server platform', async () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const getter = vi.fn(() => {
      throw new DOMException('Should not read in SSR', 'SecurityError');
    });
    const restoreStorage = installStorage(getter);
    try {
      const fixture = TestBed.createComponent(PurchaseStepper);
      fixture.componentRef.setInput('content', content);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(getter).not.toHaveBeenCalled();
      expect(
        (fixture.nativeElement as HTMLElement)
          .querySelector('[data-select-step]')
          ?.hasAttribute('disabled'),
      ).toBe(true);
    } finally {
      restoreStorage();
    }
  });
});
