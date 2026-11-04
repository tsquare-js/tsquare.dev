#!/bin/zsh
# Publishes server.json to the official MCP Registry as dev.tsquare/tsquare.
# Logs in with the tsquare.dev DNS record; the private key stays on your machine.
# Bump "version" in server.json first: published versions can't be changed.
set -euo pipefail

OPENSSL=/opt/homebrew/opt/openssl@3/bin/openssl
KEY="$HOME/.config/mcp-registry/tsquare.dev.pem"
ROOT="${0:A:h:h}"

[[ -r "$KEY" ]] || { echo "No key at $KEY (it's in 1Password)."; exit 1; }

PRIV="$("$OPENSSL" pkey -in "$KEY" -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain tsquare.dev --private-key "$PRIV"

cd "$ROOT"
mcp-publisher validate
echo
cat server.json
echo
read "?Publish this? Versions can't be edited afterwards. [y/N] " ok
[[ "$ok" == [yY] ]] || { echo "Not published."; exit 1; }
mcp-publisher publish
