The rest of this will probably be refactored

# Running the Gaia Hub

To get started running a gaia hub, execute the following:

```bash
$ git clone https://github.com/stacks-network/gaia.git
$ cd gaia/hub/
$ npm install
$ npm run build
$ cp ./config.sample.json ./config.json
# Edit the config file and add in your azure or aws credentials
$ npm run start
```

## Note on SSL

We *strongly* recommend that you deploy your Gaia hub with SSL enabled. Otherwise, the tokens used to authenticate with the Gaia hub may be stolen by attackers, which could allow them to execute writes on your behalf. 

Configuration options are available to run the hub with an `https` Node.js server. 
Otherwise, a reverse proxy web server such as nginx or Apache can be used. 

## Configuring the hub

### Driver Selection

The Gaia hub currently supports the following drivers:

```
'aws' == Amazon S3
'azure' == Azure Blob Storage
'disk' == Local disk (you must set up static web-hosting to point at this driver)
'google-cloud' === Google Cloud Storage
```

Set the driver you wish to use in your `config.json` file with the `driver` parameter. Many drivers additionally accept the `bucket` parameter, which controls the bucket name that files should be written to.

These driver may require you to provide additional credentials for performing writes to the backends. See `config.sample.json` for fields for those credentials. In some cases, the driver can use a system configured credential for the backend (e.g., if you are logged into your AWS CLI account, and run the hub from that environment, it won't need to read credentials from your `config.json`).

*Note:* The disk driver requires a *nix like filesystem interface, and will not work correctly when trying to run in a Windows environment.

### CORS Configuration

In order for a Gaia hub to operate properly CORS must be configured.

For the **write endpoint**, you must configure your server to respond to [CORS requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request). The minimum required HTTP response headers must include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE`
- `Access-Control-Allow-Headers: Authorization, Content-Type, If-Match, If-None-Match`


For the **read endpoint**, you must configure your storage driver to include the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD`
- `Access-Control-Expose-Headers: ETag`

Here's an example of a storage driver (S3) configuration:

```xml
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedOrigin>*</AllowedOrigin>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>0</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

### Require Correct Hub URL

If you turn on the `requireCorrectHubUrl` option in your `config.json`
file, your Gaia hub will require that authentication requests
correctly include the `hubURL` they are trying to connect with. This
is used to prevent a malicious gaia hub from using an authentication
token for itself on other Gaia hubs.

By default, the Gaia hub will validate that the supplied URL matches
`https://${config.serverName}`, but if there are multiple valid URLs
for clients to reach the hub at, you can include a list in your `config.json`:

```javascript
{
  ....
  serverName: "normalserver.com"
  validHubUrls: [ "https://specialserver.com/",
                  "https://legacyurl.info" ]
  ....
}
```

### The readURL parameter

By default, the gaia hub drivers will return read URLs which point directly at the written content. For example, an S3 driver would return the URL directly to the S3 file. However, if you configure a CDN or domain to point at that same bucket, you can use the `readURL` parameter to tell the gaia hub that files can be read from the given URL. For example, the `hub.blockstack.org` Gaia Hub is configured to return a read URL that looks like `https://gaia.blockstack.org/hub/`.

Unset this configuration parameter if you do not intend to deploy any caching.

### Minimum Proofs Requirement

The gaia hub can also be configured to require a minimum number of social proofs in a user's profile to accept writes from that user. This can be used as a kind of spam-control mechanism. However, we recommend for the smoothest operation of your gaia hub, to set the  `proofsConfig.proofsRequired` configuration key to `0`.

### Install Gaia Hub as Executable

To install the Gaia hub as an executable program (required for integration
testing), do the following:

```bash
$ cd gaia/hub
$ npm run build
$ sudo npm i -g # or, "sudo npm link"
$ which blockstack-gaia-hub
/usr/bin/blockstack-gaia-hub
```

If you intend to run a Gaia hub in production, you will still need to generate a
`config.json` file per the above instructions.

### Configuring SSL without a reverse proxy / web server

SSL can be setup by providing existing TLS cert files, or automatically via ACME. 

See the [`config-schema.json`](config-schema.json) file for all details on all supported config options. 

#### Using TLS cert files

Supports both cert files in both the `PFX / PKCS12` format and the `PEM key & cert chain` format.

Example of the config values for typical `pfx` cert file usage:
```json
{
  "enableHttps": "cert_files",
  "tlsCertConfig": {
    "pfxFile": "~/.config/ssl/cert.pfx"
  }
}
```

Example of the config values for the typical PEM files usage:
```json
{
  "enableHttps": "cert_files",
  "tlsCertConfig": {
    "keyFile": "~/.config/ssl/key.pem",
    "certFile": "~/.config/ssl/cert.pem"
  }
}
```

#### Using ACMEv2 client

This uses the [`greenlock-express`](https://www.npmjs.com/package/greenlock-express) middleware to provide support for Lets Encrypt v2 (i.e. [`ACME draft-12`](https://tools.ietf.org/html/draft-ietf-acme-acme-12)). 

The default ACME standard [challenge type `http-01`](https://letsencrypt.org/docs/challenge-types/#http-01-challenge) is used. This requires specifying the domain name(s) in the config _or_ ensuring that the server hostname is the intended domain name. 


However, the lib supports extensible ACME `challenge type` modules which a Gaia hub deployment system can use to easily add support for various DNS/DDNS services. Modules are already available for Google Cloud DNS, AWS (S3, Route53), Azure, CloudFlare, Digital Ocean, Namecheap, Godaddy, and more. 


Example of minimum config required to use (requires that server hostname is set to the intended domain name):
```json
{
  "enableHttps": "acme",
  "acmeConfig": {
    "email": "matt@example.com",
    "agreeTos": true
  }
}
```

Example of config where the domain name(s) are specified:
```json
{
  "enableHttps": "acme",
  "acmeConfig": {
    "email": "matt@example.com",
    "agreeTos": true,
    "approveDomains": ["gaia-testing.example.com", "gaia-testing2.example.com"]
  }
}
```



### Deploy the Hub with Docker, nginx

First have `docker`,`nginx` and `certbot` installed on a server with a FQDN pointed to it. The following guides should help you get this setup.

- [Install `nginx`](https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-16-04)
- [Install `docker`](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-16-04)
- [Install `certbot`](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-16-04) (do not run the setup yet!)

Then do the following:

- Make a folder `$HOME/hub` and copy the configuration file `config.sample.json` to `$HOME/hub/config.json` and add in your desired configuration.
- Copy `nginx.conf.sample` to `$HOME/hub/nginx.conf` and replace `hub.example.com` with your FQDN.
- `sudo rm /etc/nginx/sites-enabled/default && sudo ln $HOME/hub/nginx.conf /etc/nginx/sites-enabled/default`
- Finish `certbot` setup and cert generation
- Pull the docker image and start an instance of the container:

```bash
$ docker pull quay.io/blockstack/gaia-hub:latest
$ docker run -d --restart=always -v $HOME/hub/config.json:/src/hub/config.json -p 3000:3000 -e CONFIG_PATH=/src/hub/config.json quay.io/blockstack/gaia-hub:latest
# Now you can test the hub! The exact output will depend on your configuration
$ curl https://hub.example.com/hub_info | jq
{
  "challenge_text": "[\"gaiahub\",\"2017-09-19\",\"{{ .serverName }}\",\"blockstack_storage_please_sign\"]",
  "read_url_prefix": "https://{{ .bucketName }}.{{ .storageProviderUrl }}/"
}
```

### Run the tests

To run the unit tests:
```bash
$ npm run test
```

To run _driver_ tests and the _integration_ tests, you have
to provide configuration for the drivers. Specify a driver config
file using the environment variables:

```bash
AZ_CONFIG_PATH=test.azure.json
S3_CONFIG_PATH=test.s3.json
```

These files are JSON files that only need to contain your credentials
and bucket. For example, an azure config could look like:

```javascript
{
  "azCredentials": {
    "accountName": "your-azure-account-name",
    "accountKey": "b64-account-key"
  },
  "bucket": "spokes"
}
```

To run the tests with the azure driver tests and integration tests included:

```bash
$ AZ_CONFIG_PATH=test.azure.json npm run test
```

This also provides an easy way to test your storage provider
credentials and setup. If your tests fail the first time that may be
because the bucket setup did not complete before the test exited. Wait
a minute and try the `npm run test` command again.

To configure the logging set the `argsTransport` fields in the config file. Here is a list of [logging configuration options](https://github.com/winstonjs/winston/blob/master/docs/transports.md).



### CDN & Replicated Hubs

- https://docs.microsoft.com/en-us/azure/storage/blobs/storage-https-custom-domain-cdn


- The hub implementation is design to be ran from a single Node.js instance. If the hub instance is sharded (e.g. replicated hubs via load balancing), then any given `bucket` (identified by URI segment) must be served by the same instance, At least a couple elements of the Gaia Hub depend on this: token invalidation in-memory caching, and resource endpoint 409 contention behavior. 
