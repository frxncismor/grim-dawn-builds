import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthorPage } from './author.page';
describe('author profile page', () => {
  afterEach(() => TestBed.resetTestingModule());
  const create = (author: unknown) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { author }, paramMap: convertToParamMap({ slug: 'project' }) },
          },
        },
      ],
    });
    return TestBed.createComponent(AuthorPage);
  };
  it('shows real public bio as text, catalog ownership and an honest empty guide list', async () => {
    const f = create({
      profile: {
        slug: 'project',
        display_name: 'Proyecto',
        bio: '<img src=x onerror=fail()>',
        url: null,
      },
      ownsCatalog: true,
      guides: [],
    });
    await f.whenStable();
    expect(f.nativeElement.querySelector('h1').textContent).toBe('Proyecto');
    expect(document.title).toBe('Perfil de Proyecto · Grim Dawn Builds');
    expect(f.nativeElement.textContent).toContain('<img src=x onerror=fail()>');
    expect(f.nativeElement.querySelector('img')).toBeNull();
    expect(f.nativeElement.textContent).toContain('todavía no tiene guías publicadas');
    expect(f.nativeElement.querySelector('a[href="/tier-list"]')).not.toBeNull();
  });
  it('renders public guide metadata and a safe external author link', async () => {
    const f = create({
      profile: {
        slug: 'project',
        display_name: 'Proyecto',
        bio: null,
        url: 'https://example.org/author',
      },
      ownsCatalog: false,
      guides: [
        {
          slug: 'own-guide',
          title: 'Guía propia',
          game_version: 'test-version',
          published_at: '2026-11-10',
        },
      ],
    });
    await f.whenStable();
    expect(f.nativeElement.querySelector('a[href="/builds/own-guide"]')).not.toBeNull();
    expect(f.nativeElement.querySelector('time').getAttribute('datetime')).toBe('2026-11-10');
    const external = f.nativeElement.querySelector('a[target="_blank"]');
    expect(external.rel).toContain('noopener');
    expect(external.rel).toContain('noreferrer');
  });
  it('handles missing profiles with noindex', async () => {
    const f = create(null);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Autor no encontrado');
    expect(document.querySelector('meta[name=robots]')?.getAttribute('content')).toBe(
      'noindex,nofollow',
    );
  });
});
