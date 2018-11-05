# Private Serverless Static Website Infrastructure

This repository accompanies the Cloudreach blog post at [Hosting a private serverless static website on AWS](https://www.cloudreach.com/blog/hosting-private-serverless-static-website-aws/).

The CloudFormation code in this repository is designed to run with [Cloudreach Sceptre](https://github.com/cloudreach/sceptre). 

There are several manual steps required before the CloudFormation can be run. Some AWS resources cannot be created with CloudFormation, and others have been intentionally left out.

The lambda JS code was forked from a [blog post](https://www.ocelotconsulting.com/2016/10/03/cloudfront-security.html) and [GitHub repository](https://github.com/ocelotconsulting/s3nator) from Ocelot Consulting. Thanks!

## Deployment

All these resources must be created manually before deploying the CloudFormation stacks. Some are impossible to create with CloudFormation, some were intentionally left out. All are required.

### CloudFront Access Identity

This resource cannot be created by CloudFormation. Create one manually on the [AWS Console](https://console.aws.amazon.com/cloudfront/home?#oai).

Copy the identity ID (e.g. `E3NKNFZ8WT4N4T`) into _cloudfront-distribution.yaml_.

### Route53 Hosted Zone

It's assumed the parent R53 zone already exists as there are too many scenarios to safely create a new zone in the template.

Copy the HostedZoneID (e.g. `Z28KPDAUBQJIMT`) into _cloudfront-distribution.yaml_.

### TLS Certificate in ACM

A TLS certificate must be created in the **us-east-1** region valid for the domain the website will be served under. Note this **must** be in us-east-1, regardless of where the rest of the infrastructure is deployed. This is a requirement of using a custom domain with CloudFront.

Copy the certificate ARN (e.g. `arn:aws:acm:us-east-1:677506473622:certificate/5c4172de-db02-4887-919a-c1ee674646f7`) into _cloudfront-distribution.yaml_.

### CloudFront access key and secret key

This can only be generated by the **AWS Root Account**. Womp womp.

Our approach for handling these keys is to obtain them once with the root account and then store them in a tightly secured S3 bucket. The lambda function assumes this is what you're doing, and will try to fetch the key from an S3 bucket you define. Obtain the .pk and .rsa files, make a dedicated S3 bucket, and store the keys within.

Populate these values in _lambda-authoriser.yaml_.

* **CloudFrontKeyS3Bucket**: Name of the S3 bucket
* **CloudFrontKeyId**: Key ID (e.g. `APKAIWNCWIIVV3MAQIUA`)
* **CloudFrontKeyS3Key**: Path to the private key inside the bucket (e.g. `foo/bar/pk-APKAIWNCWIIVV3MAQIUA.pem`)

### Publish lambda to s3

* Create a new S3 bucket for the lambda ZIP file
* Run **package.sh** within the _lambda-authoriser/_ folder
* Copy the zip to s3
* Populate the S3 bucket name and S3 key of the zip into _lambda-authoriser.yaml_
* CloudFormation will retrieve the zip from S3 and provide it to Lambda

### Google API Client ID

* Create a new API project at [https://console.cloud.google.com/apis/](https://console.cloud.google.com/apis/)
* On the **Credentials** tab on the **API's & Services** section click on **Create Credentials** and choose **OAuth Client ID** and then **Web Application**
* Give a sensible name (it's displayed on the login prompt) and the full domain name you're using. (tip: Wildcards are not allowed, but you can add additional domain names to the same OAuth client later)
* Click into the newly created OAuth client and add additional authorized domains
* Go to the **OAuth consent screen** tab and fill out the fields.

Copy the OAuth Client ID (e.g. `foo13.apps.googleusercontent.com`) into _cognito-identitypool.yaml_.

### Run sceptre

`sceptre launch-env prod`

## Post deployment operations

Once sceptre has finished these actions also need performing. Unfortunately CloudFormation can't do these tasks for us either.

* A **FULL_ACCESS** S3 ACL needs setting on the on the S3 bucket created in order to allow CloudFront to write access logs. The Account ID below is the central account AWS uses to publish logs. This is [documented here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html).
  * `$ aws s3api put-bucket-acl --bucket <your logs bucket> --grant-full-control id=c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0`
* Optionally, you could change the CloudFront TLS security policy to something more secure than the default if you desire

## Upload web content to S3

Upload some content into the newly created S3 bucket. Even if only a simple Hello World message inside `index.html` the upload is necessary to prove the login flow is working as expected.

## Upload login page assets to S3

Inside the folder `public-assets/` are the html files necessary to drive the login flow. Update these values inside the `login.html` and `access_denied.html` pages wherever necessary:

* **google-signin-client_id**: Google Client ID created on the Google API Console
* **IdentityPoolId**: ID of the AWS Cognito Identity Pool
* **FunctionName**: ARN of the Lambda function

Upload these files to a folder called `public/` in the 'public' S3 bucket. e.g. `s3://public-bucket-name/public/login.html`.

## Configuring CI/CD

Our instance of this private website at Cloudreach is updated automatically by a CI/CD Pipeline.

* When users push changes to a branch our CI/CD pipeline builds the website and publishes it to a temporary URL. Reviewers can visit the temporary URL to view a dedicated version of the website. The unique git hash of the branch is used in the URL, for example `https://staging.example.com/c5c3085/index.html`
* When reviewers merge change to master the CI/CD pipeline updates content on the live website

Messages are also posted to a Slack room by way of an incoming webhook.

We use BitBucket Pipelines but any tool will do.

### Building the docker container

CI/CD is run inside a docker container. The version of Hugo is defied at docker build time by way of a build argument

    HUGO_VERSION=x.xx.x; docker build --build-arg HUGO_VERSION="${HUGO_VERSION}" -t example-org/hugo-cicd:hugo-"${HUGO_VERSION}" .

Push this image to your chosen registry. There are no secrets inside this container so it can safely be made publicly viewable. You could use the image published under the Cloudreach team but we make no guarantees it will be available forever.

### Granting CI/CD permissions

#### AWS

An AWS IAM user is required for the CI/CD Pipeline with the following IAM permissions:

* cloudfront:CreateInvalidation
* s3:ListBucket
* s3:PutObject
* s3:GetObject
* s3:DeleteObject

#### Slack Webhook

For Slack integration a new **Incoming WebHook** should be created. Take note of the generated **Webhook URL**.

### Using the BitBucket Pipeline

If you chose to use BitBucket Pipelines the yaml pipeline definition is included in this repository. The following environment variables are expected:

* **`AWS_ACCESS_KEY_ID`**: Access key of the CI/CD user
* **`AWS_SECRET_ACCESS_KEY`**: Secret key of the CI/CD user
* **`SLACK_WEBHOOK_URL`**: Webhook URL generated by Slack
