import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../src/policy.js';

describe('PolicyEngine', () => {
  it('defaults to allow when no WASM configured', async () => {
    const pe = new PolicyEngine(undefined);
    await pe.init();
    const res = await pe.evaluate({ foo: 'bar' });
    expect(res.outcome).toBe('allow');
  });
});

