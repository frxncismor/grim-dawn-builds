import { TestBed } from '@angular/core/testing';
import { TransferState } from '@angular/core';
import { describe, expect, it, afterEach } from 'vitest';
import {
  SITE_BASE_URL,
  SITE_URL_KEY,
  canonicalUrl,
  normalizeSiteUrl,
  transferSiteUrl,
} from './site-url';

afterEach(() => TestBed.resetTestingModule());

/** Synthetic userinfo exercises URL validation without storing credential URLs in source. */
function urlWithTestUserinfo(path = '/') {
  const url = new URL(path, 'https://example.test/');
  url.username = 'test-user';
  url.password = 'PRIVATE-VALUE';
  return url.href;
}

describe('public site URL', () => {
  it('normalizes the configured base and preserves a path prefix without route query or fragment', () => {
    expect(normalizeSiteUrl('https://example.test/catalog')).toBe('https://example.test/catalog/');
    expect(canonicalUrl('https://example.test/catalog/', '/tier-list?m=chaman#results')).toBe(
      'https://example.test/catalog/tier-list',
    );
    expect(canonicalUrl('https://example.test/catalog/', '/')).toBe(
      'https://example.test/catalog/',
    );
  });

  it('rejects unsafe base values without printing userinfo or query values', () => {
    for (const value of [
      '',
      'javascript:alert(1)',
      'file:///tmp/site',
      urlWithTestUserinfo(),
      'https://example.test/?token=PRIVATE-VALUE',
      'https://example.test/#PRIVATE-VALUE',
      'https://example.test/?',
      'https://example.test/#',
    ]) {
      expect(() => normalizeSiteUrl(value)).toThrow();
      try {
        normalizeSiteUrl(value);
      } catch (error) {
        expect(String(error)).not.toContain('PRIVATE-VALUE');
      }
    }
    for (const path of ['https://other.test/', '//other.test/', '/\\other.test/']) {
      expect(() => canonicalUrl('https://example.test/', path)).toThrow();
    }
    for (const path of [
      '/https://other.test/',
      '/' + urlWithTestUserinfo('/catalog/'),
      '/../outside',
      '/%2e%2e/outside',
    ]) {
      expect(() => canonicalUrl('https://example.test/catalog/', path)).toThrow();
    }
  });

  it('transfers only the validated public URL and resolves the same value during hydration', () => {
    const state = TestBed.inject(TransferState);
    expect(transferSiteUrl(state, 'https://example.test/site')).toBe('https://example.test/site/');
    expect(state.get(SITE_URL_KEY, '')).toBe('https://example.test/site/');
    expect(TestBed.inject(SITE_BASE_URL)).toBe('https://example.test/site/');
    expect(JSON.parse(state.toJson())).toEqual({
      'gd:site-base-url': 'https://example.test/site/',
    });
  });

  it('uses the explicit local-first default and never transfers an invalid URL', () => {
    expect(TestBed.inject(SITE_BASE_URL)).toBe('http://localhost:4200/');
    const state = TestBed.inject(TransferState);
    expect(() => transferSiteUrl(state, urlWithTestUserinfo())).toThrow();
    expect(state.hasKey(SITE_URL_KEY)).toBe(false);
  });
});
