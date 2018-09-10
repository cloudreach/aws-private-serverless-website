#!/bin/bash

set -ex

npm install --prefix . aws-cloudfront-sign moment
FILENAME="google-authoriser-$(uuidgen | tail -c 12).zip"
zip -r "${FILENAME}" lambda.js node_modules/

echo "Packaged up ${FILENAME}"