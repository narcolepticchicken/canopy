# Getting Started

This guide highlights how different teams can quickly start using Canopy.

## Smart-contract developers
- Leverage the Solidity verifier library to validate call-bound capabilities.
- Use the minimal ERC-2771 forwarder and venue example in `contracts/` to see end-to-end flows.

## Backend/API developers
- Install dependencies and run the `mcp-server` to issue and verify capabilities:
  ```bash
  pnpm install
  pnpm -F mcp-server dev
  ```
- Integrate policy evaluation by POSTing a `txIntent` to `/policy/evaluate` and attaching the returned proof to on-chain calls.
- Optional: plug in an OPA-compiled Wasm policy via the `POLICY_WASM_PATH` environment variable.

## Security/audit teams
- Verify capability signatures and ensure inputs are normalized (checksummed addresses, 4-byte selectors, raw args).
- Enforce short TTLs (e.g., ~60 seconds) and single-use nonces; maintain an issuer allowlist to mitigate replay.
- Use `/proof/verify` to preflight and confirm `callHash`, `expiry`, and `nonce` before executing on-chain.
