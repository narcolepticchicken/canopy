export type TxIntent = {
  chainId: number;      // chain id (e.g., 1)
  subject: string;      // user EOA (0x...)
  target:  string;      // destination contract (0x...)
  value:   string;      // hex uint256, e.g. "0x0"
  selector:string;      // 4-byte hex, e.g. "0xabcdef01"
  args:    string;      // hex calldata without selector, e.g. "0x"
  policyId:string;      // 32-byte hex
};

export { callHash } from './callHash.js';
