// AB#4723: the Android build, as npm scripts (docs/ANDROID.md).
//   npm run android:sync     build the web app and copy it into android/ (npx cap sync android)
//   npm run android:bundle   the signed release App Bundle (.aab) for Google Play: bundleRelease
//   npm run android:apk      a debug APK to install on a phone or emulator: assembleDebug
// Each checks what it needs first and stops with a message naming it: the JDK, the Android SDK and, for the
// bundle, the four signing variables. A secret's value is never printed, only whether it is set.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = resolve(ROOT, 'android');

/** The release signing variables, as android/app/build.gradle reads them. */
export const SIGNING_VARS = ['RELIC_VAULT_KEYSTORE_PATH', 'RELIC_VAULT_KEYSTORE_PASSWORD', 'RELIC_VAULT_KEY_ALIAS', 'RELIC_VAULT_KEY_PASSWORD'];

/** What stops a signed release, as sentences: unset variables by name, and a keystore path that is not a file. */
export function signingProblems(env = process.env, isFile = (p) => existsSync(p)) {
  const missing = SIGNING_VARS.filter((name) => !env[name]);
  if (missing.length) return [`Set ${missing.join(', ')}: the release is signed with the upload key, read from the environment only.`];
  if (!isFile(env.RELIC_VAULT_KEYSTORE_PATH)) return ['RELIC_VAULT_KEYSTORE_PATH does not name a keystore file that exists.'];
  return [];
}

/** What stops any Android build: no JDK, or no Android SDK (by variable or android/local.properties). */
export function toolchainProblems(env = process.env, { javaOnPath = hasJava(), localProperties = readLocalProperties() } = {}) {
  const problems = [];
  if (!env.JAVA_HOME && !javaOnPath) problems.push('No JDK: install JDK 21 and set JAVA_HOME (or put java on PATH).');
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || /^sdk\.dir=/m.test(localProperties);
  if (!sdk) problems.push('No Android SDK: install it (API 36 platform and build tools) and set ANDROID_HOME, or write sdk.dir in android/local.properties.');
  return problems;
}

function hasJava() {
  return spawnSync('java', ['-version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;
}
function readLocalProperties() {
  const file = resolve(ANDROID, 'local.properties');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function run(command, args, cwd = ROOT) {
  const r = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
}
function stop(problems) {
  for (const p of problems) console.error(`android: ${p}`);
  console.error('android: see docs/ANDROID.md.');
  process.exit(1);
}
function sync() {
  run('npm', ['run', 'build']);
  run('npx', ['cap', 'sync', 'android']);
}
function gradle(task) {
  run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [task], ANDROID);
}

const ACTIONS = {
  sync,
  bundle() {
    const problems = [...signingProblems(), ...toolchainProblems()];
    if (problems.length) stop(problems);
    sync();
    gradle('bundleRelease');
    const out = resolve(ANDROID, 'app/build/outputs/bundle/release/app-release.aab');
    if (!existsSync(out)) stop([`bundleRelease finished but ${out} is not there.`]);
    console.log(`android: signed App Bundle at ${out}`);
  },
  apk() {
    const problems = toolchainProblems();
    if (problems.length) stop(problems);
    sync();
    gradle('assembleDebug');
    const out = resolve(ANDROID, 'app/build/outputs/apk/debug/app-debug.apk');
    if (!existsSync(out)) stop([`assembleDebug finished but ${out} is not there.`]);
    console.log(`android: debug APK at ${out}`);
  },
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const action = ACTIONS[process.argv[2]];
  if (!action) stop([`usage: node scripts/android.mjs ${Object.keys(ACTIONS).join('|')}`]);
  action();
}
