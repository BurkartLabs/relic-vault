import { describe, it, expect } from 'vitest';
import { ACTIVE_FPS, IDLE_AFTER_MS, IDLE_FPS, PowerGovernor, frameRateFor, setFrameLimit, type FrameLoop } from './Power';
import { Sfx } from '../audio/Sfx';

// AB#4712: the Board, 2026-09-30: the audio kept playing with the screen off and the app minimised, and the phone ran hot.

class FakeLoop implements FrameLoop {
  running = true; fpsLimit = 0; hasFpsLimit = false; _limitRate = 0;
  sleeps = 0; wakes = 0;
  sleep() { if (this.running) { this.running = false; this.sleeps++; } }
  wake() { if (!this.running) { this.running = true; this.wakes++; } }
}
class FakeAudio { state: 'on' | 'off' = 'on'; suspendForBackground() { this.state = 'off'; } resumeFromBackground() { this.state = 'on'; } }

function setup() {
  let t = 1000;
  const loop = new FakeLoop(), audio = new FakeAudio();
  const p = new PowerGovernor(loop, audio, () => t);
  return { loop, audio, p, advance: (ms: number) => { t += ms; } };
}

describe('the game out of sight (AB#4712)', () => {
  it('sleeps the loop and silences the audio when hidden, and brings both back when shown', () => {
    const { loop, audio, p } = setup();
    p.hide();
    expect(loop.running).toBe(false);
    expect(audio.state).toBe('off');
    p.hide(); // the tab and the Android lifecycle may both report it
    expect(loop.sleeps).toBe(1);
    p.show();
    expect(loop.running).toBe(true);
    expect(audio.state).toBe('on');
    expect(loop.hasFpsLimit).toBe(false); // back at full rate
  });

  it('input and the idle check never wake a loop that is out of sight', () => {
    const { loop, p, advance } = setup();
    p.hide();
    p.input('down');
    advance(IDLE_AFTER_MS + 1);
    p.tick();
    expect(loop.running).toBe(false);
    expect(loop.wakes).toBe(0);
  });
});

describe('the frame rate in sight (AB#4712)', () => {
  it('is full while touching and for a moment after, then the idle rate', () => {
    expect(frameRateFor(0, false)).toBe(ACTIVE_FPS);
    expect(frameRateFor(IDLE_AFTER_MS - 1, false)).toBe(ACTIVE_FPS);
    expect(frameRateFor(IDLE_AFTER_MS, false)).toBe(IDLE_FPS);
    expect(frameRateFor(60_000, true)).toBe(ACTIVE_FPS); // a finger held down, e.g. mid-drag
  });

  it('drops to the idle rate when left alone and returns to full at the next touch', () => {
    const { loop, p, advance } = setup();
    advance(IDLE_AFTER_MS + 10);
    p.tick();
    expect(p.fps).toBe(IDLE_FPS);
    expect(loop).toMatchObject({ hasFpsLimit: true, fpsLimit: IDLE_FPS, _limitRate: 1000 / IDLE_FPS, running: true });
    p.input('down');
    expect(p.fps).toBe(ACTIVE_FPS);
    expect(loop.hasFpsLimit).toBe(false);
  });

  it('re-binds a running loop so the new limit takes (Phaser binds its step when the loop starts)', () => {
    const loop = new FakeLoop();
    setFrameLimit(loop, IDLE_FPS);
    expect(loop.sleeps).toBe(1);
    expect(loop.wakes).toBe(1);
    const asleep = new FakeLoop(); asleep.running = false;
    setFrameLimit(asleep, IDLE_FPS);
    expect(asleep.wakes).toBe(0); // a sleeping loop is not woken by a rate change
  });
});

describe('Sfx in the background (AB#4712)', () => {
  function fakeContext() {
    return { state: 'running', suspended: 0, resumed: 0, currentTime: 5,
      suspend() { this.state = 'suspended'; this.suspended++; return Promise.resolve(); },
      resume() { this.state = 'running'; this.resumed++; return Promise.resolve(); } };
  }

  it('suspends a running context, resumes it on return, and a tap in between does not wake it', () => {
    const sfx = new Sfx();
    const ac = fakeContext();
    sfx.ac = ac as unknown as AudioContext;
    sfx.suspendForBackground();
    expect(ac.state).toBe('suspended');
    sfx.unlock(); // a stray pointer event while hidden
    expect(ac.state).toBe('suspended');
    sfx.resumeFromBackground();
    expect(ac.state).toBe('running');
    expect([ac.suspended, ac.resumed]).toEqual([1, 1]);
  });

  it('plays nothing while backgrounded, so nothing piles up to sound at once on return', () => {
    const sfx = new Sfx();
    const ac = fakeContext();
    sfx.ac = ac as unknown as AudioContext;
    let scheduled = 0;
    (sfx as any).tone = () => { scheduled++; };
    (sfx as any).noise = () => { scheduled++; };
    sfx.suspendForBackground();
    sfx.play('coin');
    sfx.chime(3);
    expect(scheduled).toBe(0);
  });
});
