import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TocObserver } from './toc-observer';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: Callback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve(element: Element) {
    this.observed.splice(this.observed.indexOf(element), 1);
  }
  disconnect() {
    this.disconnected = true;
  }
  fire(entries: { id: string; intersecting: boolean }[]) {
    this.callback(
      entries.map(({ id, intersecting }) => ({
        target: this.observed.find((e) => e.id === id)!,
        isIntersecting: intersecting,
      })),
    );
  }
}

const sections = ['resumen', 'prioridades', 'habilidades', 'fuentes'];

function mountSections(present: readonly string[] = sections): void {
  for (const id of present) {
    const el = document.createElement('section');
    el.id = id;
    document.body.append(el);
  }
}

async function create(platform = 'browser', ids: readonly string[] = sections) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TocObserver],
    providers: [{ provide: PLATFORM_ID, useValue: platform }],
  });
  const fixture = TestBed.createComponent(TocObserver);
  fixture.componentRef.setInput('ids', ids);
  const active: string[] = [];
  fixture.componentInstance.activeChange.subscribe((id) => active.push(id));
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, active, observer: FakeObserver.instances.at(-1) };
}

describe('gd-toc-observer (spec004 T021)', () => {
  beforeEach(() => {
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('renders nothing and observes every section that exists in the page', async () => {
    mountSections(['resumen', 'habilidades', 'fuentes']);
    const { fixture, observer } = await create();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
    expect(observer!.observed.map((e) => e.id)).toEqual(['resumen', 'habilidades', 'fuentes']);
  });

  it('looks at the upper half of the viewport, where an anchored section lands', async () => {
    mountSections();
    const { observer } = await create();
    expect(observer!.options?.rootMargin).toBe('0px 0px -50% 0px');
  });

  it('emits the later of two sections sharing the band, and keeps the last one when none is inside', async () => {
    mountSections();
    const { observer, active } = await create();
    observer!.fire([{ id: 'prioridades', intersecting: true }]);
    expect(active).toEqual(['prioridades']);
    observer!.fire([{ id: 'habilidades', intersecting: true }]);
    expect(active.at(-1)).toBe('habilidades');
    observer!.fire([{ id: 'prioridades', intersecting: false }]);
    expect(active.at(-1)).toBe('habilidades');
    observer!.fire([
      { id: 'habilidades', intersecting: false },
      { id: 'fuentes', intersecting: true },
    ]);
    expect(active.at(-1)).toBe('fuentes');
    observer!.fire([{ id: 'fuentes', intersecting: false }]);
    expect(active.at(-1)).toBe('fuentes');
    expect(active).toEqual(['prioridades', 'habilidades', 'fuentes']);
  });

  it('follows a section whose element is replaced later, as deferred blocks do', async () => {
    mountSections();
    const { observer, active } = await create();
    const stale = document.getElementById('habilidades')!;
    const fresh = document.createElement('section');
    fresh.id = 'habilidades';
    stale.replaceWith(fresh);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer!.observed).toContain(fresh);
    expect(observer!.observed).not.toContain(stale);
    observer!.fire([{ id: 'habilidades', intersecting: true }]);
    expect(active).toEqual(['habilidades']);
  });

  it('disconnects when destroyed', async () => {
    mountSections();
    const { fixture, observer } = await create();
    fixture.destroy();
    expect(observer!.disconnected).toBe(true);
  });

  it('does nothing without IntersectionObserver or on the server', async () => {
    mountSections();
    await create('server');
    expect(FakeObserver.instances).toHaveLength(0);
    vi.stubGlobal('IntersectionObserver', undefined);
    const { active } = await create();
    expect(active).toEqual([]);
  });
});
