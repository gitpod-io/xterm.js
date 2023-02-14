#!/bin/bash

set -Eeuo pipefail

cp /workspace/xterm.js/supervisor-ide-config.json /ide/
rm /ide/xterm && true
ln -s /workspace/xterm.js /ide/xterm
echo "xterm: linked in /ide"

gp rebuild "$@"
