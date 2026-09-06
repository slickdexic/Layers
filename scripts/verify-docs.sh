#!/bin/bash
# Compatibility entry point; use npm run check:docs on any platform.
set -e
cd "$(dirname "$0")/.."
exec node scripts/verify-docs.js "$@"
