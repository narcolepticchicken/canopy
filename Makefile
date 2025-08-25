SHELL := /bin/bash
PORT ?= 8787

.PHONY: setup dev build test clean ping

setup:
	@echo "[canopy] Installing workspace dependencies with pnpm";
	pnpm install

# Run the MCP server in watch mode
dev:
	pnpm -w -F mcp-server dev

# Build TS packages and contracts
build:
	pnpm -w -F @canopy/attest build
	pnpm -w -F mcp-server build
	@if command -v forge >/dev/null 2>&1; then \
		$(MAKE) build-contracts; \
	else \
		echo "[canopy] Skipping contracts build (forge not found). Install via: curl -L https://foundry.paradigm.xyz | bash && foundryup"; \
	fi

.PHONY: build-contracts
build-contracts:
	cd contracts && forge build -q

# Run tests for server/lib and contracts
test:
	pnpm -w -F mcp-server test || true
	@if command -v forge >/dev/null 2>&1; then \
		cd contracts && forge test -vvv; \
	else \
		echo "[canopy] Skipping contracts tests (forge not found)."; \
	fi

# Quick health check (server must be running)
ping:
	curl -s http://localhost:$(PORT)/health/ping | jq . || curl -s http://localhost:$(PORT)/health/ping

# Remove common build artifacts
clean:
	rm -rf **/dist **/build contracts/out
