import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('./visual-baselines-docker.sh', import.meta.url), 'utf8');
const docs = await Promise.all(
  ['CONTRIBUTING.md', 'CONTRIBUTING.es.md'].map(async (name) => ({
    name,
    text: await readFile(new URL(`../${name}`, import.meta.url), 'utf8'),
  })),
);
const code = script
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

test('the container script never reads /src: the tree arrives on stdin', () => {
  assert.doesNotMatch(code, /\/src\b/);
  assert.match(code, /tar -C \/work -xf -/);
});

test('the script aborts when a secret path reaches /work, without tar -X or wildcard excludes', () => {
  assert.match(code, /\.env/);
  assert.match(code, /\.env\.example/);
  assert.match(code, /infra\/docker\/secrets/);
  assert.match(code, /exit 1/);
  assert.doesNotMatch(code, /tar\b[^\n]*\s-X\b/);
  assert.doesNotMatch(code, /--exclude/);
});

test('both CONTRIBUTING files send the git-filtered tree over stdin and do not mount the repo', () => {
  for (const { name, text } of docs) {
    assert.doesNotMatch(text, /\$PWD:\/src/, `${name} must not mount $PWD:/src`);
    assert.match(
      text,
      /git ls-files -co --exclude-standard -z \| tar --null -T - -cf - \| docker run -i/,
      `${name} must pipe git ls-files into docker run -i`,
    );
    assert.doesNotMatch(text, /tar -X/, `${name} must not use tar -X`);
  }
});
