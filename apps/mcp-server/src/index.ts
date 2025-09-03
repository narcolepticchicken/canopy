import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { Wallet, TypedDataDomain, keccak256, AbiCoder, getBytes, verifyTypedData, randomBytes } from 'ethers';
import { callHash, type TxIntent as TxIntentType } from '@canopy/attest';
import { PolicyEngine, type Decision } from './policy.js';

const abi = AbiCoder.defaultAbiCoder();
const app = express();
app.use(express.json({ limit: '128kb' }));

// Issuer key (dev). In prod, use HSM / EIP-1271 issuer.
const issuer = process.env.ISSUER_ECDSA_PRIVATE_KEY
  ? new Wallet(process.env.ISSUER_ECDSA_PRIVATE_KEY!)
  : Wallet.createRandom();

const TxIntent = z.object({
  chainId: z.number().int().positive(),
  subject: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  target:  z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  value:   z.string().regex(/^0x[0-9a-fA-F]+$/),
  selector:z.string().regex(/^0x[0-9a-fA-F]{8}$/),
  args:    z.string().regex(/^0x[0-9a-fA-F]*$/),
  policyId:z.string().length(66)
});

type TxIntent = z.infer<typeof TxIntent>;
const policy = new PolicyEngine(process.env.POLICY_WASM_PATH);
await policy.init();

const capabilityTypes = {
  CompliantCall: [
    { name: 'subject',  type: 'address' },
    { name: 'verifier', type: 'address' },
    { name: 'target',   type: 'address' },
    { name: 'value',    type: 'uint256' },
    { name: 'argsHash', type: 'bytes32' },
    { name: 'policyId', type: 'bytes32' },
    { name: 'expiry',   type: 'uint64'  },
    { name: 'nonce',    type: 'uint256' }
  ]
} as const;

function domain(intent: TxIntent, verifier: string): TypedDataDomain {
  return { name: 'Canopy', version: '1', chainId: intent.chainId, verifyingContract: verifier };
}
function nowSec() { return Math.floor(Date.now() / 1000); }

app.get('/health/ping', (_req, res) => {
  res.json({ ok: true, issuer: issuer.address, policy: policy.status() });
});

app.post('/policy/evaluate', async (req, res) => {
  const parsed = TxIntent.safeParse(req.body?.txIntent);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const tx = parsed.data;

  const decision: Decision = await policy.evaluate({ txIntent: tx });

  const ch = callHash(tx as TxIntentType);
  const expiry = nowSec() + 60;
  const nonceHex = keccak256(abi.encode(['bytes32','address'], [ch, issuer.address]));
  const verifier = tx.target;
  const argsHash = keccak256(getBytes(tx.args));

  const value = {
    subject:  tx.subject,
    verifier,
    target:   tx.target,
    value:    BigInt(tx.value),
    argsHash,
    policyId: tx.policyId,
    expiry,
    nonce:    BigInt(nonceHex)
  };

  const sig = await issuer.signTypedData(domain(tx, verifier), capabilityTypes as any, value);
  res.json({
    decision,
    artifacts: {
      callHash: ch,
      expiry,
      nonce: nonceHex,
      capabilitySig: sig
    }
  });
});

app.post('/capability/issue', async (req, res) => {
  const { txIntent, verifier, expiry, nonce } = req.body || {};
  const parsed = TxIntent.safeParse(txIntent);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  if (!verifier) return res.status(400).json({ error: 'verifier required' });

  const tx = parsed.data;
  const ch = callHash(tx as TxIntentType);
  const argsHash = keccak256(getBytes(tx.args));
  const val = {
    subject:  tx.subject,
    verifier,
    target:   tx.target,
    value:    BigInt(tx.value),
    argsHash,
    policyId: tx.policyId,
    expiry:   Number(expiry ?? (nowSec() + 60)),
    nonce:    typeof nonce === 'string' ? BigInt(nonce) : BigInt(nonce ?? keccak256(abi.encode(['bytes32','address'], [ch, issuer.address])))
  };
  const sig = await issuer.signTypedData(domain(tx, verifier), capabilityTypes as any, val);
  res.json({
    capabilitySig: sig,
    callHash: ch,
    issuer: issuer.address,
    expiry: val.expiry,
    nonce: '0x' + (val.nonce as bigint).toString(16)
  });
});

app.post('/proof/verify', async (req, res) => {
  const { txIntent, verifier, capabilitySig, expiry, nonce } = req.body || {};
  const parsed = TxIntent.safeParse(txIntent);
  if (!parsed.success) return res.status(400).json({ valid: false, reason: 'bad txIntent' });
  if (!verifier || !capabilitySig || expiry == null || nonce == null) {
    return res.status(400).json({ valid: false, reason: 'missing fields (verifier, capabilitySig, expiry, nonce)' });
  }
  if (Number(expiry) < nowSec()) {
    return res.status(400).json({ valid: false, reason: 'stale (expiry)' });
  }

  const tx = parsed.data;
  const argsHash = keccak256(getBytes(tx.args));
  const value = {
    subject:  tx.subject,
    verifier,
    target:   tx.target,
    value:    BigInt(tx.value),
    argsHash,
    policyId: tx.policyId,
    expiry:   Number(expiry),
    nonce:    typeof nonce === 'string' ? BigInt(nonce) : BigInt(nonce)
  };

  try {
    const recovered = verifyTypedData(domain(tx, verifier), capabilityTypes as any, value, capabilitySig);
    res.json({ valid: true, recovered });
  } catch (e: any) {
    res.status(400).json({ valid: false, reason: e.message });
  }
});

// --- EAS offchain attestation (minimal) ---
// Issues an EAS-compatible offchain attestation for the callHash + expiry + nonce.
// Requires env: EAS_CHAIN_ID, EAS_ADDRESS, optional EAS_SCHEMA_UID
app.post('/eas/attest', async (req, res) => {
  const { txIntent, expiry, nonce } = req.body || {};
  const parsed = TxIntent.safeParse(txIntent);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const tx = parsed.data;

  const chainIdEnv = process.env.EAS_CHAIN_ID;
  const easAddr = process.env.EAS_ADDRESS;
  const schemaUid = process.env.EAS_SCHEMA_UID || '0x' + '0'.repeat(64);
  if (!chainIdEnv || !easAddr) {
    return res.status(400).json({ ok: false, reason: 'EAS_ADDRESS and EAS_CHAIN_ID required in env' });
  }

  const chainId = Number(chainIdEnv);
  const ch = callHash(tx as TxIntentType);
  const exp = Number(expiry ?? (nowSec() + 60));
  const nn = typeof nonce === 'string' ? BigInt(nonce) : BigInt(nonce ?? keccak256(abi.encode(['bytes32','address'], [ch, issuer.address])));
  const data = abi.encode(['bytes32','uint64','uint256'], [ch, exp, nn]);

  const domain: TypedDataDomain = { name: 'EAS Attestation', version: '1.0.0', chainId, verifyingContract: easAddr };
  const types = {
    Attest: [
      { name: 'schema',          type: 'bytes32' },
      { name: 'recipient',       type: 'address' },
      { name: 'time',            type: 'uint64'  },
      { name: 'expirationTime',  type: 'uint64'  },
      { name: 'revocable',       type: 'bool'    },
      { name: 'refUID',          type: 'bytes32' },
      { name: 'data',            type: 'bytes'   },
      { name: 'salt',            type: 'bytes32' }
    ]
  } as const;

  const msg = {
    schema: schemaUid,
    recipient: tx.subject,
    time: BigInt(nowSec()),
    expirationTime: BigInt(exp),
    revocable: true,
    refUID: '0x' + '0'.repeat(64),
    data,
    salt: '0x' + Buffer.from(randomBytes ? randomBytes(32) : getBytes(keccak256(getBytes(issuer.privateKey)))).toString('hex')
  };

  try {
    const signature = await issuer.signTypedData(domain, types as any, msg);
    res.json({ ok: true, domain, types: 'EAS.Attest', message: msg, signature });
  } catch (e: any) {
    res.status(400).json({ ok: false, reason: e.message });
  }
});


const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[canopy] MCP server on :${port} (issuer ${issuer.address})`));
