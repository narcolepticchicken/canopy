# Canopy

Canopy turns an intended transaction into a short‑lived, verifiable capability bound to a specific on‑chain call. It provides:

- Call‑bound EIP‑712 capability issuance and verification (off‑chain preflight).
- Optional EAS off‑chain attestation containing the call binding (callHash, expiry, nonce).
- A pluggable policy engine (OPA → Wasm). Defaults to allow.
- Solidity helpers: an on‑chain verifier library, a minimal ERC‑2771 forwarder, and a venue example.

## Prerequisites
- Node 20+ (an `.nvmrc` is provided): `nvm use`
- pnpm (v10; pinned via `packageManager`): `corepack enable` then `corepack prepare pnpm@10.0.0 --activate`
- Optional (contracts): Foundry (forge/cast) — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Tools: `curl`, `jq`

## Repository Layout
- `apps/mcp-server/`: Express server (capability issue/verify, EAS).
- `pkg/attest/`: Shared TS lib exposing `callHash(txIntent)` and `TxIntent` type.
- `contracts/`: Foundry workspace (verifier lib, 2771 forwarder, venue example).
- `.github/workflows/ci.yml`: CI for Node/pnpm and Foundry.
- `examples.http`: Ready‑to‑run requests for local testing.
- `Makefile`: Shortcuts for setup/dev/build/test.

## Architecture
Canopy converts a `txIntent` into a call‑bound capability in three steps:

1. Build `txIntent`.
2. `POST /policy/evaluate` → `{ decision, callHash, expiry, nonce, capabilitySig }`.
3. Send the call with the capability proof; the destination or `POST /proof/verify` validates it.

Read [docs/architecture.md](docs/architecture.md) for diagrams, endpoint details, and EIP‑712 structures.

## Setup & Run
```bash
pnpm install                # install workspace deps
pnpm -w -F @canopy/attest build
pnpm -w -F mcp-server dev   # starts API on :8787
# New terminal
curl -s http://localhost:8787/health/ping | jq
```

Makefile shortcuts
- `make setup` — pnpm install
- `make build` — builds TS packages and, if present, contracts
- `make dev` — run server in watch mode
- `make test` — Vitest (server) + Foundry tests (if installed)

## Configuration
Copy `.env.example` to `.env` and set as needed:
- `ISSUER_ECDSA_PRIVATE_KEY`: dev EOA for capability issuance (secp256k1 hex)
- `PORT`: server port (default 8787)
- EAS (optional): `EAS_CHAIN_ID`, `EAS_ADDRESS`, `EAS_SCHEMA_UID`
- Policy (optional): `POLICY_WASM_PATH` to an OPA‑compiled Wasm file

## API
Base URL: `http://localhost:8787`

- `GET /health/ping` → `{ ok, issuer, policy }`
- `POST /policy/evaluate` → issues an EIP‑712 capability and returns artifacts
- `POST /proof/verify` → checks capability signature + TTL/nonce
- `POST /eas/attest` → returns EAS‑compatible offchain attestation (typed data + signature)

Evaluate example
```bash
curl -s -X POST http://localhost:8787/policy/evaluate \
  -H "content-type: application/json" \
  -d '{
    "txIntent":{
      "chainId":1,
      "subject":"0x0000000000000000000000000000000000000001",
      "target":"0x0000000000000000000000000000000000000002",
      "value":"0x0",
      "selector":"0xabcdef01",
      "args":"0x",
      "policyId":"0x0000000000000000000000000000000000000000000000000000000000000042"
    }
  }' | jq
```

## Development
- Tests (Node): `pnpm -w -F mcp-server test`
- Tests (Foundry): `cd contracts && forge build && forge test -vvv`
- Policy engine: place compiled OPA Wasm at `POLICY_WASM_PATH`; otherwise the engine allows by default.

## CI
GitHub Actions builds the TS workspace and the Foundry contracts:
- Node: `actions/setup-node@v4` + `pnpm/action-setup@v4`
- Foundry: `foundry-rs/foundry-toolchain@v1`

## Security Notes
- Never commit real secrets; use `.env` and provide `.env.example` only.
- Capabilities include expiry and nonce; keep TTLs short and verify server‑side.

## Contributing
Ape in with a PR—just read [CONTRIBUTING.md](CONTRIBUTING.md) and vibe with [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
