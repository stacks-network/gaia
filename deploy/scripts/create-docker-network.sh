#!/bin/sh -x
BINARY="/usr/bin/docker"
NETWORK="gaia"
${BINARY} network inspect ${NETWORK} > /dev/null 2>&1
CHECK=$?
if [[ $CHECK -ne 0 ]];then
  ${BINARY} network create -d bridge ${NETWORK}
fi
exit 0
