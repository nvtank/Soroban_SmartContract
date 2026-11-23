#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$WORKTREE_ROOT/.env.local"

if [ -n "${STELLAR_CLI_LD_LIBRARY_PATH:-}" ]; then
    export LD_LIBRARY_PATH="$STELLAR_CLI_LD_LIBRARY_PATH:${LD_LIBRARY_PATH:-}"
fi
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

# Ensure git status in contracts/ is clean before deploy
if [ -n "$(git status --porcelain "$WORKTREE_ROOT/contracts/")" ]; then
    echo "Error: Uncommitted changes in contracts/ directory. Please commit before deploying." >&2
    exit 1
fi

DEPLOY_COMMIT=$(git rev-parse HEAD)
echo "Deploying contract from commit: $DEPLOY_COMMIT"

FORCE=false
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE=true
    fi
done

# Idempotency check: if STELLAR_CONTRACT_ID is set and --force is not passed, skip.
if [ "$FORCE" = false ] && [ -f "$ENV_FILE" ]; then
    EXISTING_ID=$(grep -E '^STELLAR_CONTRACT_ID=' "$ENV_FILE" | cut -d= -f2- | tr -d ' "' || true)
    if [ -n "$EXISTING_ID" ]; then
        echo "Contract already deployed with ID: $EXISTING_ID"
        echo "Use --force to redeploy."
        exit 0
    fi
fi

echo "=== Deploying RentFlow Soroban Contract to Stellar Testnet ==="

fund_if_needed() {
    local name="$1"
    local addr
    if ! addr=$(stellar keys address "$name" 2>/dev/null) || [ -z "$addr" ]; then
        echo "Generating identity $name..."
        stellar keys generate "$name" --network testnet --fund
    else
        echo "Identity $name already exists ($addr). Verifying funding..."
        curl -s "https://friendbot.stellar.org/?addr=$addr" >/dev/null || true
    fi
}

fund_if_needed "rentflow-platform"
fund_if_needed "rentflow-admin"
fund_if_needed "rentflow-oracle"

PLATFORM_ADDR=$(stellar keys address rentflow-platform)
ADMIN_ADDR=$(stellar keys address rentflow-admin)
ORACLE_ADDR=$(stellar keys address rentflow-oracle)

PLATFORM_SECRET=$(stellar keys secret rentflow-platform)
ADMIN_SECRET=$(stellar keys secret rentflow-admin)
ORACLE_SECRET=$(stellar keys secret rentflow-oracle)

echo "Building WASM contract..."
stellar contract build --manifest-path "$WORKTREE_ROOT/contracts/rentflow/Cargo.toml"

WASM_PATH="$WORKTREE_ROOT/contracts/rentflow/target/wasm32v1-none/release/rentflow.wasm"
if [ ! -f "$WASM_PATH" ]; then
    echo "Error: WASM not found at $WASM_PATH" >&2
    exit 1
fi

echo "Deploying contract via constructor (__constructor) to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source-account rentflow-platform \
    --network testnet \
    -- \
    --admin "$ADMIN_ADDR" \
    --oracle "$ORACLE_ADDR")

echo "Contract deployed successfully! Contract ID: $CONTRACT_ID"

# Immediately record STELLAR_CONTRACT_ID to avoid orphan contracts
python3 - <<EOF
import re

env_file = "$ENV_FILE"
contract_id = "$CONTRACT_ID"
admin_secret = "$ADMIN_SECRET"
oracle_secret = "$ORACLE_SECRET"
platform_secret = "$PLATFORM_SECRET"

with open(env_file, "r") as f:
    content = f.read()

def update_var(txt, key, val):
    pattern = rf"^{key}=.*$"
    if re.search(pattern, txt, flags=re.MULTILINE):
        return re.sub(pattern, f"{key}={val}", txt, flags=re.MULTILINE)
    return txt + f"\n{key}={val}"

content = update_var(content, "STELLAR_CONTRACT_ID", contract_id)
content = update_var(content, "STELLAR_ADMIN_SECRET", admin_secret)
content = update_var(content, "STELLAR_ORACLE_SECRET", oracle_secret)
content = update_var(content, "STELLAR_PLATFORM_SECRET", platform_secret)

with open(env_file, "w") as f:
    f.write(content)
EOF

echo "Updated .env.local with STELLAR_CONTRACT_ID and secrets (without printing secrets)."
echo "=== Deployment Completed Successfully ==="
echo "Deployed commit: $DEPLOY_COMMIT"
echo "STELLAR_CONTRACT_ID=$CONTRACT_ID"
echo "ADMIN_ADDR=$ADMIN_ADDR"
echo "ORACLE_ADDR=$ORACLE_ADDR"
echo "PLATFORM_ADDR=$PLATFORM_ADDR"
