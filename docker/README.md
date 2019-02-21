# Running a Gaia Hub with docker-compose

Please refer to the [Official Docs](https://docs.blockstack.org/storage/overview.html) for the most up to date instructions.



## MacOS for local testing/development

The following assumes you have [Docker Installed](https://docs.docker.com/docker-for-mac/install/)
* Recommended to also have [MacOS Homebrew](https://docs.brew.sh/Installation) installed
* Use Homebrew to install jq  with `brew install jq`

In your working directory:
1. clone a copy of the [gaia repo](https://github.com/blockstack/gaia):
```
$ git clone \
      -b master \
      --single-branch \
      https://github.com/blockstack/gaia \
  gaia
```

2. Change your cwd:
```
$ cd gaia/docker
```

3. Start the server:
```
$ docker-compose \
      --project-directory ./docker \
      -f ./docker/docker-compose.yaml \
up -d
```

4. Verify the server is responding locally:
```
$ curl -s localhost/hub_info | jq
{
	"challenge_text": "[\"gaiahub\",\"0\",\"hub\",\"blockstack_storage_please_sign\"]",
	"latest_auth_version": "v1",
	"read_url_prefix": "http://localhost:80/hub/"
}
```

5. Optional - test writes to local gaia-hub:

  ** *this is a workaround for MacOS* **
    1. `sudo mv /usr/local/include /usr/local/include.save`

    2. `npm install blockstack`

    3. ` sudo mv /usr/local/include.save /usr/local/include`

    4. `node gaia_test.js`

  ```
  $ node gaia_test.js
  [DEBUG] connectToGaiaHub: http://localhost:80/hub_info
  [DEBUG] uploadToGaiaHub: uploading foo.txt to http://localhost:80
  Upload to gaia hub thinks it can read from: http://localhost:80/hub/18FBCKvm4WVSPNqdT9V11fDDzP1V1Jayg1/foo.txt
  Hub info thinks it can read from: http://localhost:80/hub/18FBCKvm4WVSPNqdT9V11fDDzP1V1Jayg1/foo.txt
  Contents of file: hello world!
  ```

### Modifying the configuration for your gaia-hub
Two methods exist:
1. Edit the `hub-config/config.json` using `vim` or other
  * requires a restart of the containers: `docker-compose restart`


2. Use the running `admin` container to modify any config values, and also reload the hub when complete:
  - [GitHub - Gaia Admin README.md](https://github.com/blockstack/gaia/blob/master/admin/README.md)

  ```
  $ export API_KEY="hello"
  $ curl -s \
        -H "Authorization: bearer $API_KEY" \
        -H 'Content-Type: application/json' \
        -X POST \
        --data-raw '{"serverName": "myserver"}' \
    http://localhost:8009/v1/admin/config

  $ curl -s \
        -H "Authorization: bearer $API_KEY" \
        -X POST \
    http://localhost:8009/v1/admin/reload

  $ curl -s \
        -H "Authorization: bearer $API_KEY" \
    http://localhost:8009/v1/admin/config | jq
  ```
