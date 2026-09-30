import { describe, it, expect } from 'vitest';
import { parseAmStart, devtoolsSocket, freeEmulatorPort } from './android-qa.mjs';

// AB#4730: the parts of the device-QA script that read adb's output. The run itself needs a device; these do not.
describe('android-qa reads adb', () => {
  it('reads the launch times out of am start -W', () => {
    const out = 'Starting: Intent { cmp=com.madgod_games.relic_vault/.MainActivity }\nStatus: ok\nLaunchState: COLD\nActivity: com.madgod_games.relic_vault/.MainActivity\nTotalTime: 2232\nWaitTime: 2260\nComplete\n';
    expect(parseAmStart(out)).toEqual({ totalTime: 2232, waitTime: 2260, status: 'ok' });
    expect(parseAmStart('Error: Activity not started')).toEqual({ totalTime: null, waitTime: null, status: null });
  });

  it("finds this process's WebView DevTools socket and nobody else's", () => {
    const unix = [
      '0000000000000000: 00000002 00000000 00010000 0001 01 25841 @webview_devtools_remote_3895',
      '0000000000000000: 00000002 00000000 00010000 0001 01 25842 @webview_devtools_remote_1200',
      '0000000000000000: 00000002 00000000 00010000 0001 01 25843 @stetho_com.google.android.apps.messaging_devtools_remote',
    ].join('\r\n');
    expect(devtoolsSocket(unix, '3895')).toBe('webview_devtools_remote_3895');
    expect(devtoolsSocket(unix, '38')).toBeNull();
    expect(devtoolsSocket(unix, '4000')).toBeNull();
  });

  it('picks an emulator port no running emulator holds', () => {
    const devices = 'List of devices attached\nemulator-5556\tdevice\nemulator-5700\tdevice\nemulator-5703\toffline\n';
    expect(freeEmulatorPort(devices)).toBe(5704); // 5702 is free but 5703 (its adb port) is taken
    expect(freeEmulatorPort('List of devices attached\n')).toBe(5700);
  });
});
