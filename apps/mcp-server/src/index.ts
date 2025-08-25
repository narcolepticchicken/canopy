import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { Wallet, TypedDataDomain, keccak256, AbiCoder, getBytes, verifyTypedData } from 'ethers';
import { callHash, type TxIntent as TxIntentType } from '@canopy/attest';

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
  res.json({ ok: true, issuer: issuer.address });
});

app.post('/policy/evaluate', async (req, res) => {
  const parsed = TxIntent.safeParse(req.body?.txIntent);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const tx = parsed.data;

  const decision = { outcome: 'allow', reasons: [] as string[] };

  const ch = callHash(tx as TxIntentType);
  const expiry = nowSec() + 60;
  const nonceHex = keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32','address'], [ch, issuer.address]));
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
    nonce:    typeof nonce === 'string' ? BigInt(nonce) : BigInt(nonce ?? keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32','address'], [ch, issuer.address])))
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

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[canopy] MCP server on :${port} (issuer ${issuer.address})`));
