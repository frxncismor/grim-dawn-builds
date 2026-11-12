import { afterAll, afterEach, beforeAll, describe } from 'vitest';
import { runContentRepositoryContract } from '@gd/domain/testing';
import { ApiContentRepository } from '../../src/app/core/content/api.repository';
import { ContainerContentFixture } from '../../apps/api/test/content-fixture';

// Integration orchestration only: application zones retain their production boundaries.
const enabled = process.env['RUN_DB_TESTS'] === '1' || process.env['CI'] === 'true';
const suite = enabled ? describe : describe.skip;

suite('T-062 real web adapter → container API → container PostgreSQL', () => {
  const fixture = new ContainerContentFixture();
  beforeAll(() => fixture.start(), 90000);
  afterEach(() => fixture.reset(), 30000);
  afterAll(() => fixture.close(), 30000);
  runContentRepositoryContract(
    'ApiContentRepository over container HTTP',
    async (docs, options, collections) => {
      if (options.includeDrafts) throw new Error('Public API never enables drafts');
      const base = await fixture.create(docs, collections);
      const repository = new ApiContentRepository(base);
      await repository.ready();
      return repository;
    },
    { localDrafts: false },
  );
});
