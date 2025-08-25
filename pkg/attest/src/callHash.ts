import { AbiCoder, keccak256, getBytes } from 'ethers';
import type { TxIntent } from './index.js';

export function callHash(tx: TxIntent): string {
  const argsHash = keccak256(getBytes(tx.args)); // keccak(args)
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ['uint256','address','address','bytes4','uint256','bytes32'],
    [tx.chainId, tx.target, tx.subject, tx.selector as any, BigInt(tx.value), argsHash]
  );
  return keccak256(encoded);
}
