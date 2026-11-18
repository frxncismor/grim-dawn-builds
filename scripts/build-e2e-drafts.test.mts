import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runDraftsBuild, type DraftsStep } from './build-e2e-drafts.mts';

// C-002: the drafts artifact must also get the files that `pnpm build` emits after Angular
// (`emit-static-assets`: mastery trees, `deferred.css`, portraits); without them the shell 404s.

test('runDraftsBuild runs the Angular build and then emit-static-assets on the drafts artifact', async () => {
  const steps: DraftsStep[] = [];
  const code = await runDraftsBuild(async (step) => {
    steps.push(step);
    return 0;
  });
  assert.equal(code, 0);
  assert.equal(steps.length, 2);
  assert.match(
    steps[0]!.args.join(' '),
    /ng\.js build --output-path \.\.\/\.\.\/dist\/e2e-drafts$/,
  );
  assert.equal(steps[0]!.env['INCLUDE_DRAFTS'], 'true');
  const emit = steps[1]!.args;
  assert.match(
    emit.find((arg) => arg.endsWith('emit-static-assets.mts')) ?? '',
    /tools[\\/]emit-static-assets\.mts$/,
  );
  assert.equal(
    emit[emit.indexOf('--dir') + 1]?.replaceAll('\\', '/').endsWith('dist/e2e-drafts'),
    true,
  );
  assert.equal(steps[1]!.env['INCLUDE_DRAFTS'], 'true');
});

test('runDraftsBuild does not emit static assets when the Angular build fails', async () => {
  const steps: DraftsStep[] = [];
  const code = await runDraftsBuild(async (step) => {
    steps.push(step);
    return 3;
  });
  assert.equal(code, 3);
  assert.equal(steps.length, 1);
});
