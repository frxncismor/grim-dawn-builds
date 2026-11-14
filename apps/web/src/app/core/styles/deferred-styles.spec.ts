import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFERRED_STYLES_HREF, DeferredStyles } from './deferred-styles';

describe('DeferredStyles (own stylesheet for components created in the browser, T033)', () => {
  afterEach(() => {
    document.head.querySelectorAll('link[data-gd-deferred-styles]').forEach((el) => el.remove());
    TestBed.resetTestingModule();
  });

  const links = () => document.head.querySelectorAll('link[data-gd-deferred-styles]');

  it('adds one same-origin stylesheet link to the head, however many times it is asked', () => {
    const service = TestBed.inject(DeferredStyles);
    service.ensure();
    service.ensure();
    expect(links()).toHaveLength(1);
    const link = links()[0] as HTMLLinkElement;
    expect(link.getAttribute('rel')).toBe('stylesheet');
    expect(link.getAttribute('href')).toBe(DEFERRED_STYLES_HREF);
    expect(DEFERRED_STYLES_HREF).toBe('/assets/deferred.css');
    expect(link.hasAttribute('onload')).toBe(false);
    expect(link.getAttribute('media')).toBeNull();
  });

  it('does not duplicate a link already rendered by the server', () => {
    const existing = document.createElement('link');
    existing.setAttribute('rel', 'stylesheet');
    existing.setAttribute('href', DEFERRED_STYLES_HREF);
    existing.setAttribute('data-gd-deferred-styles', '');
    document.head.appendChild(existing);
    TestBed.inject(DeferredStyles).ensure();
    expect(links()).toHaveLength(1);
    expect(TestBed.inject(DOCUMENT)).toBe(document);
  });
});
