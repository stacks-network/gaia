# Deploy your GAIA Hub

Step by step instructions to setup you own GAIA Hub can be found in the following links. General configuration and platform agnostic setup is explained further below.

* [GAIA Hub on Linux](setup_linux.md)
* [GAIA Hub on Mac](setup_mac.md)

## Configuring your GAIA HUB

### Configuration files
The following configuration files exist in the folder `deploy/configs/gaia/`:

```
admin-config.json
hub-config.json
reader-config.json
```

### GAIA Admin Service
You can also use the GAIA Admin Service to remotely administer it with an API Key. It will require you to install `npm` with a `apt install npm`. Once `npm` is installed you can continue with the steps in the [GAIA Admin Service](https://github.com/stacks-network/gaia/blob/master/admin/README.md).

### Driver Selection

The Gaia hub currently supports the following drivers:

```
'aws' == Amazon S3
'azure' == Azure Blob Storage
'disk' == Local disk
'google-cloud' === Google Cloud Storage
```

Set the driver you wish to use in your [config.json](https://github.com/stacks-network/gaia/blob/master/hub/config.sample.json) file with the `driver` parameter. Many drivers additionally accept the `bucket` parameter, which controls the bucket name that files should be written to.

These driver may require you to provide additional credentials for performing writes to the backends. See `config.sample.json` for fields for those credentials. In some cases, the driver can use a system configured credential for the backend (e.g., if you are logged into your AWS CLI account, and run the hub from that environment, it won't need to read credentials from your `config.json`).

*Note:* The disk driver requires a *nix like filesystem interface, and will not work correctly when trying to run in a Windows environment.

### Note on SSL
We *strongly* recommend that you deploy your Gaia hub with SSL enabled. Otherwise, the tokens used to authenticate with the Gaia hub may be stolen by attackers, which could allow them to execute writes on your behalf.  
Configuration options are available to run the hub with an `https` Node.js server.  
Otherwise, a reverse proxy web server such as nginx or Apache can be used.  

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

### CDN & Replicated Hubs

- https://docs.microsoft.com/en-us/azure/storage/blobs/storage-https-custom-domain-cdn


- The hub implementation is design to be ran from a single Node.js instance. If the hub instance is sharded (e.g. replicated hubs via load balancing), then any given `bucket` (identified by URI segment) must be served by the same instance, At least a couple elements of the Gaia Hub depend on this: token invalidation in-memory caching, and resource endpoint 409 contention behavior. 
