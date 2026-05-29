#!/bin/bash
set -e

source "$HOME/.cargo/env"

echo "Building Weekly Goals..."
npm run tauri build 2>&1 | tail -5

echo "Installing to Applications..."
cp -R "src-tauri/target/release/bundle/macos/Weekly Goals.app" "/Applications/Weekly Goals.app"

echo "Done. Quit and reopen Weekly Goals to get the new version."
