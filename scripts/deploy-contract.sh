#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKTREE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$WORKTREE_ROOT/.env.local"

# Auto-detect libdbus if stellar CLI needs it and LD_LIBRARY_PATH is unset
if [ -n "${STELLAR_CLI_LD_LIBRARY_PATH:-}" ]; then
    export LD_LIBRARY_PATH="$STELLAR_CLI_LD_LIBRARY_PATH:${LD_LIBRARY_PATH:-}"
elif [ -d "/nix/store/yanmwp5f435ing2nbhwa4v0gdmpl2an1-dbus-1.16.2-lib/lib" ]; then
    export LD_LIBRARY_PATH="/nix/store/yanmwp5f435ing2nbhwa4v0gdmpl2an1-dbus-1.16.2-lib/lib:${LD_LIBRARY_PATH:-}"
fi

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

DRY_RUN=false
FORCE=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--force]"
            echo "  --dry-run  Build WASM and print commands without deploying"
            echo "  --force    Deploy even if STELLAR_CONTRACT_ID already exists in .env.local"
            exit 0
            ;;
    esac
done

if [ "$DRY_RUN" = true ]; then
    echo "=== [DRY RUN] RentFlow Soroban Contract Deployment Simulation ==="
    echo "Mode: DRY RUN (no network deployment, no keys generated, no .env modifications)"

    DEPLOY_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    echo "Deploy commit target: $DEPLOY_COMMIT"

    if [ -n "$(git status --porcelain "$WORKTREE_ROOT/contracts/")" ]; then
        echo "[DRY RUN WARNING] Working tree in contracts/ has uncommitted modifications."
    else
        echo "[DRY RUN] contracts/ directory is clean."
    fi

    echo "Building WASM contract..."
    stellar contract build --manifest-path "$WORKTREE_ROOT/contracts/rentflow/Cargo.toml"

    WASM_PATH="$WORKTREE_ROOT/contracts/rentflow/target/wasm32v1-none/release/rentflow.wasm"
    if [ ! -f "$WASM_PATH" ]; then
        echo "Error: WASM not found at $WASM_PATH" >&2
        exit 1
    fi

    WASM_SIZE=$(wc -c < "$WASM_PATH" | tr -d ' ')
    WASM_HASH=$(sha256sum "$WASM_PATH" | awk '{print $1}')
    echo "[DRY RUN] WASM built successfully:"
    echo "          Path: $WASM_PATH"
    echo "          Size: $WASM_SIZE bytes"
    echo "          SHA-256: $WASM_HASH"

    # Read existing addresses if available, or use placeholder
    PLATFORM_ADDR=$(stellar keys address rentflow-platform 2>/dev/null || echo "<SIMULATED_PLATFORM_ADDRESS>")
    ADMIN_ADDR=$(stellar keys address rentflow-admin 2>/dev/null || echo "<SIMULATED_ADMIN_ADDRESS>")
    ORACLE_ADDR=$(stellar keys address rentflow-oracle 2>/dev/null || echo "<SIMULATED_ORACLE_ADDRESS>")

    echo ""
    echo "=== Deployment plan (commands that will execute when run without --dry-run): ==="
    echo "1. Verify / Fund Stellar Testnet identities:"
    echo "   stellar keys generate rentflow-platform --network testnet --fund"
    echo "   stellar keys generate rentflow-admin --network testnet --fund"
    echo "   stellar keys generate rentflow-oracle --network testnet --fund"
    echo ""
    echo "2. Deploy WASM via __constructor:"
    echo "   stellar contract deploy \\"
    echo "       --wasm \"$WASM_PATH\" \\"
    echo "       --source-account rentflow-platform \\"
    echo "       --network testnet \\"
    echo "       -- \\"
    echo "       --admin \"$ADMIN_ADDR\" \\"
    echo "       --oracle \"$ORACLE_ADDR\""
    echo ""
    echo "3. Update .env.local with deployed contract ID and secret keys:"
    echo "   STELLAR_CONTRACT_ID=<DEPLOYED_CONTRACT_ID>"
    echo "   STELLAR_ADMIN_SECRET=<ADMIN_SECRET>"
    echo "   STELLAR_ORACLE_SECRET=<ORACLE_SECRET>"
    echo "   STELLAR_PLATFORM_SECRET=<PLATFORM_SECRET>"
    echo ""
    echo "=== [DRY RUN] Complete. No changes made. ==="
    exit 0
fi

# ==================== LIVE DEPLOYMENT ====================

# Ensure git status in contracts/ is clean before deploy
if [ -n "$(git status --porcelain "$WORKTREE_ROOT/contracts/")" ]; then
    echo "Error: Uncommitted changes in contracts/ directory. Please commit before deploying." >&2
    exit 1
fi

DEPLOY_COMMIT=$(git rev-parse HEAD)
echo "Deploying contract from commit: $DEPLOY_COMMIT"

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
