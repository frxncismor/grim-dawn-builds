import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Icon } from './icon';
describe('own icon with a reserved image slot', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('provides a labelled image when meaningful and hides decorative imagery', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'damage-rayo');
    fixture.componentRef.setInput('label', 'Daño de rayo');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toBe('Daño de rayo');
    const img = root.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('assets/icons/damage-rayo.svg');
    expect(img.getAttribute('width')).toBe('24');
    expect(img.getAttribute('height')).toBe('24');
    expect(img.alt).toBe('');
    expect(root.tabIndex).toBe(-1);
    fixture.componentRef.setInput('label', null);
    await fixture.whenStable();
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });
  it('replaces a failed approved image without changing its declared dimensions', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'damage-rayo');
    fixture.componentRef.setInput('size', 'large');
    fixture.componentRef.setInput('source', {
      id: 'damage-rayo',
      src: 'assets/official/fixture.svg',
      fallbackSrc: 'assets/icons/damage-rayo.svg',
    });
    await fixture.whenStable();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toBe('assets/official/fixture.svg');
    expect(img.width).toBe(32);
    img.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(img.getAttribute('src')).toBe('assets/icons/damage-rayo.svg');
    expect(img.width).toBe(32);
    fixture.componentRef.setInput('source', {
      id: 'damage-rayo',
      src: 'assets/official/next.svg',
      fallbackSrc: 'assets/icons/damage-rayo.svg',
    });
    await fixture.whenStable();
    expect(img.getAttribute('src')).toBe('assets/official/next.svg');
  });
  it('falls back before requesting an unknown or unsafe descriptor', async () => {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'unknown');
    fixture.componentRef.setInput('source', {
      id: 'generic',
      src: 'https://example.test/private.svg',
      fallbackSrc: 'assets/icons/generic.svg',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      'assets/icons/generic.svg',
    );
  });
});
