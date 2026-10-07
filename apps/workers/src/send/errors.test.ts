import { describe, expect, it } from 'vitest';
import { isTransientSendError } from './errors.js';

const smtp = (responseCode: number) => Object.assign(new Error('smtp'), { responseCode });
const net = (code: string) => Object.assign(new Error(code), { code });

describe('isTransientSendError', () => {
  it('retries SMTP 4xx and gives up on 5xx', () => {
    expect(isTransientSendError(smtp(421))).toBe(true);
    expect(isTransientSendError(smtp(451))).toBe(true);
    expect(isTransientSendError(smtp(550))).toBe(false);
    expect(isTransientSendError(smtp(554))).toBe(false);
  });

  it('retries when the relay cannot be reached', () => {
    for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']) {
      expect(isTransientSendError(net(code))).toBe(true);
    }
  });

  it('does not retry an error it does not recognise', () => {
    expect(isTransientSendError(new Error('Invalid address'))).toBe(false);
  });
});
