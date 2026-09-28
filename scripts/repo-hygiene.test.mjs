import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// AB#4738: a release pipeline must never find a signing key or a Google service-account credential in the repository.
// This fails if one is tracked: by name (*.jks, *.keystore, *.p12, *.pk8) or, for JSON, by shape, whatever the file is
// called: a service account is { "type": "service_account", ..., "private_key": "-----BEGIN PRIVATE KEY-----..." }.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const KEY_FILE = /\.(jks|keystore|p12|pk8)$/i;

/** True when `text` is a Google service-account key file. */
export function isServiceAccountJson(text) {
  let o;
  try { o = JSON.parse(text); } catch { return false; }
  return !!o && typeof o === 'object' && o.type === 'service_account' && typeof o.private_key === 'string';
}

const tracked = () => execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);

describe('no signing key or service-account credential is tracked (AB#4738)', () => {
  it('knows a key file and a service account when it sees one', () => {
    expect(KEY_FILE.test('android/release.jks')).toBe(true);
    expect(KEY_FILE.test('upload.KEYSTORE')).toBe(true);
    expect(KEY_FILE.test('android/app/build.gradle')).toBe(false);
    const sa = JSON.stringify({ type: 'service_account', project_id: 'p', private_key_id: 'x', private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n', client_email: 'a@p.iam.gserviceaccount.com' });
    expect(isServiceAccountJson(sa)).toBe(true);
    expect(isServiceAccountJson(JSON.stringify({ type: 'module', name: 'relic-vault' }))).toBe(false);
    expect(isServiceAccountJson('not json')).toBe(false);
  });

  it('finds no *.jks, *.keystore, *.p12 or *.pk8 among the tracked files', () => {
    const files = tracked();
    expect(files.length).toBeGreaterThan(50); // it really listed the repository
    expect(files.filter((f) => KEY_FILE.test(f))).toEqual([]);
  });

  it("finds no tracked JSON with a service account's shape, whatever its name", () => {
    const json = tracked().filter((f) => f.toLowerCase().endsWith('.json'));
    expect(json).toContain('package.json');
    expect(json.filter((f) => isServiceAccountJson(readFileSync(join(ROOT, f), 'utf8')))).toEqual([]);
  });

  it('keeps the generated and built files out: version.properties, Android build output, dist', () => {
    const files = tracked();
    expect(files.filter((f) => /^(dist|apps\/web\/dist-qa|android\/app\/build|android\/\.gradle)\//.test(f) || f === 'android/version.properties')).toEqual([]);
  });
});
