/**
 * T-054 / T-165: static checks of the API image definition (apps/api/Dockerfile and the root .dockerignore).
 *
 * Scope: text checks only, no Docker daemon needed. They keep both base images pinned by exact patch
 * and digest, the runtime on the minimal Alpine base with the distro security updates applied, the
 * runtime user numeric and non-root, the runtime layers free of secrets and host files, and the ignore
 * patterns in place. `docker build` / `docker run` are verified outside this suite; container checks in
 * CI are T-066b.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const dockerignore = readFileSync(new URL('../../../.dockerignore', import.meta.url), 'utf8');

/** Logical instructions in order: comments and blank lines dropped, `\` continuations joined. */
const instructions = (() => {
  const result: string[] = [];
  let current = '';
  for (const raw of dockerfile.split('\n')) {
    const line = raw.trim();
    if (current === '' && (line === '' || line.startsWith('#'))) continue;
    current = current === '' ? line : `${current} ${line}`;
    if (current.endsWith('\\')) {
      current = current.slice(0, -1).trimEnd();
      continue;
    }
    result.push(current);
    current = '';
  }
  return result;
})();

/** Lines of the final stage: everything after its FROM. */
const runtimeStage = instructions.slice(instructions.findIndex((l) => /AS runtime$/.test(l)));

describe('apps/api/Dockerfile (T-054)', () => {
  it('uses exactly two stages on the .nvmrc Node patch pinned by digest (no latest, no floating tag)', () => {
    const nvmrc = readFileSync(new URL('../../../.nvmrc', import.meta.url), 'utf8').trim();
    const patch = nvmrc.replaceAll('.', '\\.');
    const froms = instructions.filter((line) => /^FROM /.test(line));
    expect(froms).toEqual([
      expect.stringMatching(
        new RegExp(`^FROM node:${patch}-slim@sha256:[0-9a-f]{64} AS build$`),
      ),
      expect.stringMatching(
        new RegExp(`^FROM node:${patch}-alpine@sha256:[0-9a-f]{64} AS runtime$`),
      ),
    ]);
    expect(dockerfile).not.toMatch(/latest/i);
  });

  it('installs pnpm at the packageManager version and installs production deps with pnpm deploy', () => {
    expect(dockerfile).toContain('pnpm@12.18.0');
    expect(dockerfile).toContain('--frozen-lockfile');
    expect(dockerfile).toMatch(/pnpm --filter @gd\/api deploy --prod /);
  });

  it('runs the API on Alpine and applies the distro security updates before the scan gate (T-165)', () => {
    const joined = runtimeStage.join('\n');
    expect(joined).toMatch(/^FROM node:[\d.]+-alpine@sha256:[0-9a-f]{64} AS runtime$/m);
    expect(joined).toMatch(/apk upgrade --no-cache/);
    expect(joined).not.toMatch(/apt-get|dpkg/);
  });

  it('drops the package managers from the runtime stage (T-066b scan surface)', () => {
    const joined = runtimeStage.join('\n');
    expect(joined).toMatch(/rm -rf \/usr\/local\/lib\/node_modules\/npm/);
    expect(joined).toMatch(/rm -f \/usr\/local\/bin\/npm/);
    expect(joined).toMatch(/corepack/);
  });

  it('passes no secrets through ARG or ENV (ENV only sets non-secret runtime config)', () => {
    expect(instructions.filter((line) => /^ARG\b/.test(line))).toEqual([]);
    const envKeys = instructions
      .filter((line) => /^ENV\b/.test(line))
      .flatMap((line) => [...line.matchAll(/(\w+)=/g)].map((m) => m[1]));
    expect(envKeys.sort()).toEqual(['API_HOST', 'API_PORT', 'NODE_ENV']);
  });

  it('runs as a fixed, non-root numeric user created with the Alpine tools', () => {
    const user = runtimeStage.filter((line) => /^USER\b/.test(line));
    expect(user).toEqual(['USER 10001:10001']);
    expect(dockerfile).toMatch(/addgroup -S -g 10001 api/);
    expect(dockerfile).toMatch(/adduser -S -u 10001 -G api/);
    expect(runtimeStage.indexOf('USER 10001:10001')).toBeLessThan(
      runtimeStage.findIndex((line) => /^CMD\b/.test(line)),
    );
  });

  it('copies into the runtime stage only from the build stage (no host context, no .env, no secrets)', () => {
    const copies = runtimeStage.filter((line) => /^COPY\b/.test(line));
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) {
      expect(copy).toMatch(/^COPY --from=build /);
      expect(copy).not.toMatch(/\.env|secrets/);
    }
  });

  it('excludes the repository root context and secret files from the runtime stage', () => {
    expect(runtimeStage.join('\n')).not.toMatch(/COPY \. |ADD /);
  });
});

describe('root .dockerignore (T-054)', () => {
  const patterns = dockerignore
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  it.each(['**/.env*', '.git', '**/node_modules', '**/dist'])('excludes %s', (pattern) => {
    expect(patterns).toContain(pattern);
  });

  it('excludes secrets directories', () => {
    expect(patterns).toContain('**/secrets');
  });
});
