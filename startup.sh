#!/bin/bash -li
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


 # DO NOT REMOVE THE SPACES AT THE BEGINNING OF THESE LINES
 # The spaces at the beginning of the line prevent those lines from being added to
 # the bash history.
 set +o history
 history -c
 truncate -s 0 "$HISTFILE"

# This is the main entrypoint to workspace container in Gitpod. It is called (and controlled) by the supervisor
# container root process.
# To mimic a regular login shell on a local computer we execute this with "bash -li" (interactive login shell):
#  - login (-l): triggers sourcing of ~/.profile and similar files
#  - interactive (-i): triggers sourcing of ~/.bashrc (and similar). This is necessary because Theia sub-processes
#    started from non-interactive shells rely some values that we (and others) tend to place into .bashrc
#    (exmaples: language servers, other language tools)
# Reference: https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files.html#Bash-Startup-Files

export SHELL=/bin/bash
export USER=gitpod

cd /ide || exit
exec /ide/node/bin/gitpod-node /ide/server.js "$@"
