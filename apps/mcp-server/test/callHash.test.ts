import { describe, it, expect } from 'vitest';
import { callHash, type TxIntent } from '@canopy/attest';
import { AbiCoder, keccak256, getBytes } from 'ethers';

describe('callHash', () => {
  it('computes a stable 32-byte hash for a txIntent', () => {
    const tx: TxIntent = {
      chainId: 1,
      subject: '0x0000000000000000000000000000000000000001',
      target:  '0x0000000000000000000000000000000000000002',
      value:   '0x0',
      selector:'0xabcdef01',
      args:    '0x',
      policyId:'0x' + '0'.repeat(63) + '1'
    };
    const fromLib = callHash(tx);
    const argsHash = keccak256(getBytes(tx.args));
    const manual = keccak256(
      AbiCoder.defaultAbiCoder().encode(
        ['uint256','address','address','bytes4','uint256','bytes32'],
        [tx.chainId, tx.target, tx.subject, tx.selector as any, BigInt(tx.value), argsHash]
      )
    );
    expect(fromLib).toEqual(manual);
    expect(fromLib).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});

