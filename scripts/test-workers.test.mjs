// AB#4768: several agents run their suites on one PC at once. vitest's default (a worker per core less one) and
// Playwright's (half the cores, each a browser) size each run for an idle machine, so together they oversubscribe it.
// Both configs take their bound from scripts/test-workers.mjs; these tests keep it set and keep it small.

import { describe, expect, it } from 'vitest';
import { MAX_WORKERS, PLAYWRIGHT_WORKERS, workers } from './test-workers.mjs';
import viteConfig from '../vite.config.ts';
import playwrightConfig from '../playwright.config.ts';

describe('test worker bound', () => {
  it('is two vitest workers and one Playwright worker unless the environment says otherwise', () => {
    expect(MAX_WORKERS).toBe(workers(process.env.TEST_MAX_WORKERS, 2));
    expect(PLAYWRIGHT_WORKERS).toBe(workers(process.env.TEST_PLAYWRIGHT_WORKERS, 1));
    if (!process.env.TEST_MAX_WORKERS) expect(MAX_WORKERS).toBe(2);
    if (!process.env.TEST_PLAYWRIGHT_WORKERS) expect(PLAYWRIGHT_WORKERS).toBe(1);
  });

  it('takes a count or a percentage from the environment, and nothing else', () => {
    expect(workers('6', 2)).toBe(6);
    expect(workers('50%', 2)).toBe('50%');
    for (const bad of [undefined, '', '0', '-1', '0%', '150%', 'lots', '2.5']) expect(workers(bad, 2)).toBe(2);
  });

  it('is what the vitest and Playwright configs use', () => {
    expect(viteConfig.test.maxWorkers).toBe(MAX_WORKERS);
    expect(playwrightConfig.workers).toBe(PLAYWRIGHT_WORKERS);
  });
});
