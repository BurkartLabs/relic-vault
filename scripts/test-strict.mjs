#!/usr/bin/env node
/**
 * `npm test` for Relic Vault.
 *
 * Carried across from the Orchestrata control plane, where it was written for Bug #337 — vitest prints a failing
 * suite's tests as "skipped" and still writes a green-looking summary, which is how three tests shipped without
 * ever running.
 *
 * It is here because of AB#371: a Monetization Critic session found `npm test` in this repo printing
 * `vitest: not found` and **still exiting 0**, so any gate reading the exit code would have called that run green.
 * The platform had known this lesson since #337 and had never carried it to the product it ships. That is exactly
 * what learnings/TRANSFERABLE.md T-008 exists to prevent: judge a test run by the count of tests it reports, not
 * by its status. A run that executed nothing is a failure wearing a success.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

const out = '.vitest-results.json';
const run = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile=${out}`], { stdio: 'inherit', shell: process.platform === 'win32' });

let report;
try { report = JSON.parse(readFileSync(out, 'utf8')); } catch { report = null; }
rmSync(out, { force: true });

if (!report) {
  console.error('\n[test-strict] no JSON report was produced, so nothing can be said about this run.');
  console.error('[test-strict] the usual cause is that the runner itself is missing (npm ci did not complete).');
  process.exit(run.status || 1);
}

const tests = (report.testResults ?? []).flatMap((f) => (f.assertionResults ?? []).map((t) => ({ file: f.name, name: t.fullName ?? t.title, status: t.status })));
const notRun = tests.filter((t) => t.status !== 'passed' && t.status !== 'failed');
const failed = tests.filter((t) => t.status === 'failed');

// AB#371: the count is the check. Zero tests is not a pass, whatever the exit code says.
if (tests.length === 0) {
  console.error('\n[test-strict] the runner reported 0 tests. That is a failure, not a pass:');
  console.error('[test-strict] either no test file was collected, or the run died before collecting any.');
  process.exit(1);
}
if (notRun.length) {
  console.error(`\n[test-strict] ${notRun.length} test(s) never ran (a suite that fails in setup reports them as skipped):`);
  for (const t of notRun) console.error(`  - ${t.status}: ${t.name}`);
}
if (failed.length || notRun.length || run.status !== 0) process.exit(1);
console.log(`\n[test-strict] ${tests.length} tests, all executed and passing.`);
