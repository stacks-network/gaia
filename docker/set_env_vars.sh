#!/bin/sh
# this is for testing locally
for i in `cat gaia.env`; do
  echo "export $i"
done
echo ""
echo "# now -> copypasta the output to terminal"
echo ""
