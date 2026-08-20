import { describe, expect, it } from 'vitest';
import { PROVIDER_COMPLETION_LIMITS, providerCompletionLimit } from './constants';

/*
 * The 8192 default is what makes a long page get written in continuations, which is where the
 * truncated files and duplicated artifacts come from. MAX_COMPLETION_TOKENS is the way out of it,
 * so it is worth proving the override actually reaches the number that gets sent upstream.
 */
describe('the output token ceiling', () => {
  it('uses the provider default when nothing is configured', () => {
    expect(providerCompletionLimit('OpenRouter')).toBe(PROVIDER_COMPLETION_LIMITS.OpenRouter);
  });

  it('honours the override, which arrives from the environment as a string', () => {
    expect(providerCompletionLimit('OpenRouter', '32000')).toBe(32000);
  });

  it('accepts a number as readily as a string', () => {
    expect(providerCompletionLimit('OpenRouter', 16384)).toBe(16384);
  });

  it('ignores values that are not a usable number, rather than sending NaN upstream', () => {
    for (const bad of ['', 'muchos', '0', '-1', undefined]) {
      expect(providerCompletionLimit('OpenRouter', bad)).toBe(PROVIDER_COMPLETION_LIMITS.OpenRouter);
    }
  });

  it('rounds down, because a fractional token limit is rejected', () => {
    expect(providerCompletionLimit('OpenRouter', '16384.7')).toBe(16384);
  });

  it('has no default to offer for a provider it does not know', () => {
    expect(providerCompletionLimit('UnaCosaRara')).toBeUndefined();
  });
});
