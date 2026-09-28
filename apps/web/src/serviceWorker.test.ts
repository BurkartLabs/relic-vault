import { describe, it, expect } from 'vitest';
import { swPlan } from './serviceWorker';

// Bug #4787: the Android app registers no service worker, and clears one a previous build left behind.
const base = { supported: true, native: false, registrations: 0, controlled: false, reloadedOnce: false };

describe('the service worker (Bug #4787)', () => {
  it('registers on the web, and does nothing where there are no workers', () => {
    expect(swPlan(base)).toBe('register');
    expect(swPlan({ ...base, supported: false })).toBe('none');
    expect(swPlan({ ...base, native: true })).toBe('none');
  });

  it('in the app, removes a worker a previous build left, reloading once only if it was serving the page', () => {
    expect(swPlan({ ...base, native: true, registrations: 1, controlled: true })).toBe('remove-and-reload');
    expect(swPlan({ ...base, native: true, registrations: 1, controlled: false })).toBe('remove');
    // never a reload loop: after the one reload, removing is all it does
    expect(swPlan({ ...base, native: true, registrations: 1, controlled: true, reloadedOnce: true })).toBe('remove');
  });
});
