# canopy

Canopy turns an intended transaction into a **provable, short-lived permission** bound to that exact call (capability now; EAS/EAT later).

## Quickstart
```bash
pnpm install
pnpm -w -F @canopy/attest build
pnpm -w -F mcp-server dev
```

Then:
```bash
curl -s http://localhost:8787/health/ping | jq
```

## CI Tooling
- Node: `actions/setup-node@v4`
- pnpm: `pnpm/action-setup@v4`
- Foundry: `foundry-rs/foundry-toolchain@v1`
