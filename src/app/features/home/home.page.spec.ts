import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { HomePage } from './home.page';
import { CATALOG_STATE } from '../../core/content/catalog.resolver';
import { SITE_BASE_URL } from '../../core/seo/site-url';
import { input } from '../tier-list/catalog.test-data';
describe('native Home from public server snapshot', () => {
  afterEach(() => TestBed.resetTestingModule());
  const setup = () =>
    TestBed.configureTestingModule({
      providers: [
        { provide: SITE_BASE_URL, useValue: 'https://example.org/project/' },
        provideRouter([]),
      ],
    });
  it('offers the real catalog and editorial criteria when no guide is public', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, { ...input, guides: [] });
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('h1')).toHaveLength(1);
    expect(f.nativeElement.querySelector('a[href="/tier-list"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('a[href="#criterios"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('#criterios')).not.toBeNull();
    expect(f.nativeElement.textContent).toContain('No guides published yet');
    expect(f.nativeElement.querySelector('a[href^="/builds/"]')).toBeNull();
    expect(f.nativeElement.querySelector('button,input,iframe')).toBeNull();
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://example.org/project/og/site.png',
    );
  });
  it('features only public title/date/version, never private or guide body metadata', async () => {
    setup();
    TestBed.inject(TransferState).set(CATALOG_STATE, {
      ...input,
      guides: [
        { ...input.guides[0], rights_notes: 'PRIVATE-CANARY', summary: 'PRIVATE-BODY' } as never,
      ],
    });
    const f = TestBed.createComponent(HomePage);
    await f.whenStable();
    expect(f.nativeElement.querySelector('a[href="/builds/tormenta"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-09');
    expect(f.nativeElement.textContent).toContain('test-version');
    expect(f.nativeElement.innerHTML).not.toContain('PRIVATE-');
    expect(f.nativeElement.textContent).not.toContain('No guides published yet');
  });
  it('fails explicitly without the server snapshot', () => {
    setup();
    expect(() => TestBed.createComponent(HomePage)).toThrow('Falta el catálogo prerenderizado.');
  });
});
