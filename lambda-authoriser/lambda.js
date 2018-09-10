/*
Copyright 2018 Ocelot Consulting LLC contact@ocelotconsulting.com
Copyright 2018 Cloudreach Inc contact@cloudreach.com

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

var https = require('https');
var AWS = require('aws-sdk');
var cf = require('aws-cloudfront-sign');
var s3 = new AWS.S3();
var moment = require('moment');
var CloudFrontKeyS3Bucket = process.env.CloudFrontKeyS3Bucket;
var CloudFrontKeyS3Key = process.env.CloudFrontKeyS3Key;
var CloudFrontKeyId = process.env.CloudFrontKeyId;
var CloudFrontCookieDomain = process.env.CloudFrontCookieDomain;
var CloudFrontCookieValidityDays = process.env.CloudFrontCookieValidityDays;
var AuthorisedDomains = process.env.AuthorisedDomains.split(',');

function getS3(bucket, key){
  var params = {
    Bucket: bucket,
    Key: key
  };
  return s3.getObject(params).promise();
}

function getJSON(url) {
    var p = new Promise((resolve, reject) => {
        https.get(url, (response) => {
            var body = '';
            response.on('data', (d) => {
                body += d;
            });
            response.on('end', () => {
                resolve(JSON.parse(body));
            });
            response.on('error', (err) => {
                reject(err);
            });
        });
    });
    return p;
}

exports.handler = (event, context, callback) => {
    var tokenInfoUrl = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' +
      event.Logins['accounts.google.com'];
    getJSON(tokenInfoUrl).then((data) => {
      for (i = 0; i < AuthorisedDomains.length; i++) {
        if (data.email.endsWith(AuthorisedDomains[i])) {
          console.log("LoginApproved:"+data.email);
          var authorised = true;
          break;
        }
      }
      if (!authorised) {
        console.log("LoginRejected:"+data.email);
        throw new Error('Access denied');
      }
    })
    .then(() => {
      return getS3(`${CloudFrontKeyS3Bucket}`, `${CloudFrontKeyS3Key}`);
    })
    .then((pk) => {
      var options = {keypairId: `${CloudFrontKeyId}`, privateKeyString: pk.Body.toString(),
      expireTime: moment().add(CloudFrontCookieValidityDays, 'day')}
      callback(null, cf.getSignedCookies(`http*://${CloudFrontCookieDomain}/*`, options));
    })
    .catch((err) => {
      console.log('error', err);
      callback(err);
    });
};
