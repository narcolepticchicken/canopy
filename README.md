# Canopy — Compliance MCP Server for Call-Bound Capabilities

Canopy is a Model Context Protocol (MCP) server that issues short-lived, verifiable capabilities linking an off-chain policy decision to a specific contract call. Each capability binds a `txIntent` to a `callHash`, so only compliant transactions reach the chain.

## Who It's For
- Smart-contract developers that need policy-guarded calls
- Backend engineers building relayers or wallets with pre-flight checks
- Security teams verifying off-chain compliance before execution

## What's Inside
### apps/mcp-server
- Express API exposing `GET /health/ping`, `POST /policy/evaluate`, `POST /capability/issue`, and `POST /proof/verify`
- Loads policy logic from `POLICY_WASM_PATH` and signs capabilities with `ISSUER_ECDSA_PRIVATE_KEY`

### pkg/attest
- Shared TypeScript library providing the `TxIntent` type and `callHash` helper
- Used by both the server and on-chain contracts

### contracts
- Solidity `CanopyVerifierLib.sol`, ERC-2771 forwarder, and venue examples
- Built and tested with Foundry

### other
- `examples.http` request collection
- Documentation and configuration samples

## Features
- Short-lived `EIP-712` capabilities bound to call hashes
- Pluggable policy evaluation via OPA Wasm or custom logic
- On-chain verification library and compliant forwarder
- MCP tooling for issuance and proof verification

## Requirements
- Node.js 20+ (`.nvmrc` provided)
- `pnpm` v10 (`corepack enable` && `corepack prepare pnpm@10.0.0 --activate`)
- Optional: Foundry for contract builds (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- CLI tools: `curl`, `jq`

## Quick Start
```bash
pnpm install
pnpm -w -F @canopy/attest build
pnpm -w -F mcp-server dev
```

## How It Works
1. Build `txIntent` (chainId, subject, target, value, selector, args, policyId).
2. `POST /policy/evaluate` → `{ decision, artifacts: { callHash, expiry, nonce, capabilitySig } }`.
3. Attach proof to the on-chain call; the destination/validator verifies or pre-flights via `/proof/verify`.

### Call Binding
```solidity
callHash = keccak256(abi.encode(
  chainid, target, subject, selector, value, keccak256(args)
))
```

### Capability (`EIP-712`)
Domain: `{ name:"Canopy", version:"1", chainId, verifyingContract: verifier }`  
Type: `CompliantCall(subject, verifier, target, value, argsHash, policyId, expiry, nonce)`

### Safety
- Short TTL (e.g., 60s), single-use nonce, issuer allowlist
- Normalize inputs: checksummed `0x` addresses, 4-byte selector, raw args (no selector)

## MCP Tool Mappings
| Tool | Description | HTTP Endpoint |
|------|-------------|---------------|
| `health` | ping the server | `GET /health/ping` |
| `policy` | evaluate policy & issue capability | `POST /policy/evaluate` |
| `capability` | issue capability directly | `POST /capability/issue` |
| `proof` | verify a capability proof | `POST /proof/verify` |

## Example Request
```http
POST /policy/evaluate HTTP/1.1
Content-Type: application/json

{
  "txIntent": {
    "chainId": 1,
    "subject": "0x0000000000000000000000000000000000000001",
    "target": "0x0000000000000000000000000000000000000002",
    "value": "0x0",
    "selector": "0xabcdef01",
    "args": "0x",
    "policyId": "0x42"
  }
}
```

### Response
```json
{
  "decision": "allow",
  "artifacts": {
    "callHash": "0x...",
    "expiry": 0,
    "nonce": "0x1",
    "capabilitySig": "0x..."
  }
}
```

## Roadmap
- Additional capability schemas like `EIP-3074`
- Persistent storage for issued nonces
- More MCP tools for contract introspection

## License
MIT

