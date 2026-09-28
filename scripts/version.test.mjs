import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_VERSION_CODE, propertiesText, releaseChangelog, versionCode } from './version.mjs';

// AB#4732: versionCode = major*10000 + minor*100 + patch, and `npm version patch` tags, dates the changelog and moves
// versionCode up by exactly 1.
const HERE = dirname(fileURLToPath(import.meta.url));

describe('versionCode (AB#4732)', () => {
  it('is major*10000 + minor*100 + patch', () => {
    expect(versionCode('1.0.0')).toBe(10000);
    expect(versionCode('1.2.3')).toBe(10203);
    expect(versionCode('0.0.1')).toBe(1);
    expect(versionCode('12.34.56')).toBe(123456);
  });

  it('a patch is exactly 1 higher, a minor 100, a major 10000', () => {
    expect(versionCode('1.4.8') - versionCode('1.4.7')).toBe(1);
    expect(versionCode('1.5.0') - versionCode('1.4.99')).toBe(1); // 1.4.99 still sorts below 1.5.0
    expect(versionCode('1.5.0') - versionCode('1.4.0')).toBe(100);
    expect(versionCode('2.0.0') - versionCode('1.0.0')).toBe(10000);
  });

  it("refuses a version it cannot order: a pre-release, a minor or patch over 99, 0.0.0, past Play's cap", () => {
    for (const v of ['1.0.0-beta.1', '1.0', 'v1.0.0', '1.100.0', '1.0.100', '0.0.0']) expect(() => versionCode(v), v).toThrow();
    expect(() => versionCode(`${Math.floor(MAX_VERSION_CODE / 10000) + 1}.0.0`)).toThrow();
  });

  it('writes the properties the Android build will read', () => {
    expect(propertiesText('1.2.3')).toMatch(/^versionName=1\.2\.3$/m);
    expect(propertiesText('1.2.3')).toMatch(/^versionCode=10203$/m);
  });
});

describe('the changelog on release (AB#4732)', () => {
  const log = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n## [1.0.0] - 2026-09-19\n\n- First.\n';

  it('dates the Unreleased notes as the version and leaves Unreleased empty, in Keep a Changelog shape', () => {
    const out = releaseChangelog(log, '1.0.1', '2026-09-28');
    expect(out).toBe('# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-09-28\n\n### Added\n\n- A thing.\n\n## [1.0.0] - 2026-09-19\n\n- First.\n');
  });

  it('gives a release with no notes an entry anyway, and refuses a version twice', () => {
    const empty = releaseChangelog('# Changelog\n\n## [Unreleased]\n', '1.0.1', '2026-09-28');
    expect(empty).toContain('## [1.0.1] - 2026-09-28\n\n### Changed\n\n- No notable changes.');
    expect(() => releaseChangelog(empty.replace('## [Unreleased]', '## [Unreleased]\n\n- more'), '1.0.1', '2026-09-28')).toThrow(/already/);
    expect(() => releaseChangelog('# Changelog\n', '1.0.1', '2026-09-28')).toThrow(/Unreleased/);
  });
});

describe('npm version patch, end to end (AB#4732)', () => {
  it('bumps package.json, commits the dated changelog, tags vX.Y.Z, and versionCode rises by exactly 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rv-version-'));
    const pkg = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'rv-version-test', version: '1.0.0', private: true, type: 'module', scripts: { version: pkg.scripts.version } }, null, 2));
    mkdirSync(join(dir, 'scripts'));
    copyFileSync(join(HERE, 'version.mjs'), join(dir, 'scripts', 'version.mjs'));
    writeFileSync(join(dir, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- A bug.\n');
    mkdirSync(join(dir, 'android')); // as if the shell (AB#4723) had landed
    const run = (cmd, args) => {
      const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', shell: cmd === 'npm' && process.platform === 'win32' }); // npm is npm.cmd on Windows; git needs no shell (cmd would eat ^)
      if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stdout}\n${r.stderr}`);
      return r.stdout.trim();
    };
    run('git', ['init', '-q']);
    run('git', ['config', 'user.email', 'test@example.test']);
    run('git', ['config', 'user.name', 'Version Test']);
    run('git', ['config', 'commit.gpgsign', 'false']);
    run('git', ['config', 'tag.gpgsign', 'false']);
    writeFileSync(join(dir, '.gitignore'), 'android/version.properties\n');
    run('git', ['add', '-A']);
    run('git', ['commit', '-q', '-m', 'start']);

    run('npm', ['version', 'patch']);

    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('1.0.1');
    expect(run('git', ['tag', '--list'])).toBe('v1.0.1');
    expect(run('git', ['rev-parse', 'v1.0.1^{commit}'])).toBe(run('git', ['rev-parse', 'HEAD']));
    expect(run('git', ['show', '--name-only', '--format=%s', 'HEAD']).split('\n').filter(Boolean).sort()).toEqual(['1.0.1', 'CHANGELOG.md', 'package.json'].sort());
    expect(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')).toMatch(/## \[Unreleased\]\n\n## \[1\.0\.1\] - \d{4}-\d{2}-\d{2}\n\n### Fixed\n\n- A bug\./);
    const props = readFileSync(join(dir, 'android', 'version.properties'), 'utf8');
    expect(Number(/versionCode=(\d+)/.exec(props)[1])).toBe(versionCode('1.0.0') + 1);
    expect(props).toContain('versionName=1.0.1');
  }, 60_000);
});
