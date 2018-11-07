# Gaia Admin Service

This is a small service you can co-locate with your Gaia hub that lets you
remotely administer it with an API key.  Using this service, you can:

* Add, change, and remove whitelisted writers
* Set and change your backend storage driver
* Set and change your Gaia hub's connection settings
* Restart your Gaia hub to make the changes take effect

# Usage

## Building and Running

You can build this service from this directory as follows:

```
$ npm run build
```

To run in place:

```
$ node lib/index.js
```

To install this service as the `blockstack-gaia-admin` program in your `$PATH`:

```
$ sudo npm install -g
```

## Configuration

The admin service needs a separate config file from your Gaia hub.  Importantly,
it needs to know the following:

* where the Gaia hub config file is located
* what API key(s) will be used to authenticate administrative requests
* what command(s) to run to restart the Gaia hub on a config change

Here is a sample config file for a Gaia hub config located at
`/tmp/gaia-config.json`, and with a single API key "`hello`".  The reload
command is set to kill all instances of the `blockstack-gaia-hub` program, and
restart it with `nohup`.  You should tailor this to your deployment.

```bash
$ cat /tmp/gaia-admin.json
{
   "argsTransport": {
    "level": "debug",
    "handleExceptions": true,
    "timestamp": true,
    "stringify": true,
    "colorize": true,
    "json": true
  },
  "regtest": false,
  "testnet": false,
  "port": 8009,
  "apiKeys": ["hello"],
  "gaiaSettings": {
    "configPath": "/tmp/gaia-config.json"
  },
  "reloadSettings": {
    "command": "/bin/sh",
    "argv": ["-c", "pkill -9 blockstack-gaia-hub; nohup /usr/bin/blockstack-gaia-hub /tmp/gaia-config.json &"],
    "env": {},
    "setuid": 1000,
    "setgid": 1000
  }
}
```

In the following usage examples, we assume that the Gaia admin service runs on
`http://localhost:8009`.

## `/v1/admin/reload`: Restarting the Gaia Hub

The admin service will make changes to the Gaia hub's config file, but the
changes will only take effect when the Gaia hub is reloaded.  You can do this
as follows:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" -X POST http://localhost:8009/v1/admin/reload
{"result":"OK"}
```

When you `POST` to this endpoint, the admin service will run the command
described in the `reloadSettings` section of the config file.  In particular, 
it will attempt to spawn a subprocess from the given `reloadSettings.command` 
binary, and pass it the arguments given in `reloadSettings.argv`.  Note that the
subprocess will *NOT* be run in a shell.

You can control the reload command's environment with the following
optional configuration settings:

* `reloadSettings.env`:  This is a key/value list of any environment variables
  that need to be set for the reload command to run.
* `reloadSettings.setuid`:   This is the UID under which the command will be run.
* `reloadSettings.setgid`:  This is the GID under which the command will run.

### Errors

If you do not supply a valid API key, this method fails with HTTP 403.

This endpoint can return a HTTP 500 if the reload command fails.  If this
happens, you will get back the command's exit code and possibly the signal that
killed it.

## `/v1/admin/gaia`: Get/Set Gaia Hub Settings

This endpoint is used to read and write a Gaia hub's non-driver-related
settings.  These include the port it listens on, and its proof-checking
settings.

To read the Gaia hub settings, you would run the following:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" http://localhost:8009/v1/admin/gaia
{"config":{"port":4000,"proofsConfig":{"proofsRequired":0}}}
```

To set Gaia hub settings, you simply `POST` the changed JSON fields to this
endpoint.  If the settings were successfully applied, you will be informed to
reload your Gaia hub:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" -H 'Content-Type: application/json' -X POST --data-raw '{"port": 3001}' http://localhost:8009/v1/admin/gaia
{"message":"Config updated -- you should reload your Gaia hub now."}
```

### Message Formats

This section is derived from the `src/server.js` file.

The data accepted on `POST` must match this schema:

```
{
  type: 'object',
  properties: {
    validHubUrls: {
      type: 'array',
      items: { type: 'string', pattern: '^http://.+|https://.+$' },
    },
    requireCorrectHubUrl: { type: 'boolean' },
    serverName: { type: 'string', pattern: '.+' },
    port: { type: 'integer', minimum: 1024, maximum: 65534 },
    proofsConfig: { type: 'integer', minimum: 0 }
  }
}
```

The same fields will be returned on `GET`, but will be contained in a
`config` object.

### Errors

If you do not supply a valid API key, both the `GET` and `POST` method fail with HTTP 403.

Only relevant Gaia hub config fields will be set.  If you `POST` invalid settings values, 
you will get an HTTP 400 error.

## `/v1/admin/driver`: Get/Set Storage Driver Settings

This endpoint is used to read and write storage driver settings, including:

* The driver to use (`driver`)
* The Gaia's read URL endpoint (`readURL`)
* The number of items to return when listing files (`pageSize`)
* The driver-specific settings

You can set multiple drivers' settings with this endpoint.

To get the current driver settings, you would run:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" http://localhost:8009/v1/admin/driver
{"config":{"driver":"disk","readURL":"http://localhost:4001/","pageSize":20,"diskSettings":{"storageRootDirectory":"/tmp/gaia-disk"}}}
```

To update the driver settings, you would run:

```bash
$ export API_KEY="hello"
$ export AWS_ACCESS_KEY="<hidden>"
$ export AWS_SECRET_KEY="<hidden>"
$ curl -H "Authorization: bearer $API_KEY" -H 'Content-Type: application/json' -X POST --data-raw "{\"driver\": \"aws\", \"awsCredentials\": {\"accessKeyId\": \"$AWS_ACCESS_KEY\", \"secretAccessKey\": \"$AWS_SECRET_KEY\"}}" http://localhost:8009/v1/admin/driver
{"message":"Config updated -- you should reload your Gaia hub now."}
```

### Message Formats

This section is derived from the `src/server.js` file.

The data accepted on `POST` must match this schema:

```
{
  type: 'object',
  properties: {
    driver: { type: 'string', pattern: '.+' },
    readURL: { type: 'string', pattern: '^http://.+$|https://.+$' },
    pageSize: { type: 'integer', minimum: 1 },
    bucket: { type: 'string', pattern: '.+' },
    cacheControl: { type: 'string', pattern: '.+' },
    azCredentials: {
      accountName: { type: 'string', pattern: '.+' },
      accountKey: { type: 'string', pattern: '.+' },
    },
    diskSettings: {
      storageRootDirectory: { type: 'string' }
    },
    gcCredentials: {
      email: { type: 'string' },
      projectId: { type: 'string' },
      keyFilename: { type: 'string' },
      credentials: {
        type: 'object',
        properties: {
          client_email: { type: 'string' },
          private_key: { type: 'string' }
        }
      },
    },
    awsCredentials: {
      assessKeyId: { type: 'string' },
      secretAccessKey: { type: 'string' },
      sessionToken: { type: 'string' }
    }
  }
}
```

The same fields will be returned on `GET`, but will be bundled in a `config`
object.

### Errors

Only relevant driver config fields will be set.  If you `POST` invalid driver settings values, 
you will get an HTTP 400 error.

## `/v1/admin/whitelist`: Get/Set Whitelisted Writers

This endpoint lets you read and write the `whitelist` section of a Gaia hub, in
order to control who can write to it and list its files.

To get the current whitelist, you would run the following:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" http://localhost:8009/v1/admin/whitelist
{"config":{"whitelist":["15hUKXg1URbQsmaEHKFV2vP9kCeCsT8gUu"]}}
```

To set the whitelist, you would run the following:

```bash
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" -H 'Content-Type: application/json' -X POST --data-raw '["1KDcaHsYJqD7pwHtpDn6sujCVQCY2e1ktw", "15hUKXg1URbQsmaEHKFV2vP9kCeCsT8gUu"]' http://localhost:8009/v1/admin/whitelist
{"message":"Config updated -- you should reload your Gaia hub now."}
```

Note that you must set the *entire* whitelist.

### Message Formats

This section is derived from the `src/server.js` file.

The data accepted on `POST` must match this schema:

```
{
  type: 'array',
  items: {
    type: 'string',
    pattern: '^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$'
  }
}
```

The same fields will be returned on `GET`, but will be bundled in a `config`
object.

### Errors

If you do not supply a valid API key, both the `GET` and `POST` method fail with HTTP 403.

Only relevant Gaia hub config fields will be set.  If you `POST` invalid settings values, 
you will get an HTTP 400 error.
