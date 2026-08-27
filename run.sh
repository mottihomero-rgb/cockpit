#!/bin/zsh
cd "$(dirname "$0")"
unset ELECTRON_RUN_AS_NODE ELECTRON_NO_ATTACH_CONSOLE NODE_OPTIONS VSCODE_PID VSCODE_CWD VSCODE_IPC_HOOK_CLI
exec ./node_modules/.bin/electron . "$@"
