# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

ARG NODE_VERSION=16.13.2

FROM node:${NODE_VERSION} AS node_installer
RUN mkdir -p /ide/node/bin \
    /ide/node/include/node/ \
    /ide/node/lib/node_modules/npm/ \
    /ide/node/lib/ && \
    cp -a  /usr/local/bin/node              /ide/node/bin/ && \
    cp -a  /usr/local/bin/npm               /ide/node/bin/ && \
    cp -a  /usr/local/bin/npx               /ide/node/bin/ && \
    cp -ar /usr/local/include/node/         /ide/node/include/ && \
    cp -ar /usr/local/lib/node_modules/npm/ /ide/node/lib/node_modules/

# rename node executable
RUN cp /ide/node/bin/node /ide/node/bin/gitpod-node && rm /ide/node/bin/node

FROM alpine:latest as ide_installer
COPY ./demo/ /ide/
COPY ./node_modules /ide/node_modules
RUN chmod -R ugo+x /ide

FROM scratch
# copy static web resources in first layer to serve from blobserve
COPY --chown=33333:33333 --from=ide_installer /ide/ /ide/
COPY --chown=33333:33333 --from=node_installer /ide/node /ide/node
COPY --chown=33333:33333 startup.sh supervisor-ide-config.json /ide/
