import { describe, expect, it } from 'vitest';
import { getReturnPath } from './route-guards.util';

describe('getReturnPath', () => {
  it('returns a safe in-app path from state', () => {
    expect(getReturnPath({ from: '/objects/1?tab=a#x' })).toBe('/objects/1?tab=a#x');
  });

  it.each([
    ['null state', null],
    ['undefined state', undefined],
    ['string state', '/objects'],
    ['no from', {}],
    ['non-string from', { from: 1 }],
    ['relative path', { from: 'objects' }],
    ['protocol-relative url', { from: '//evil.com' }],
    ['external url', { from: 'https://evil.com' }],
    ['login path', { from: '/login' }],
    ['login path with query', { from: '/login?x=1' }],
  ])('falls back to root for %s', (_name, state) => {
    expect(getReturnPath(state)).toBe('/');
  });

  it('does not treat paths merely starting with login as the login page', () => {
    expect(getReturnPath({ from: '/loginx' })).toBe('/loginx');
  });
});
