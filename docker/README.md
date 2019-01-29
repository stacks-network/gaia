# Running a Gaia Hub with docker-compose

### MacOS for local testing/development
The following assumes you have [Docker Installed](https://docs.docker.com/docker-for-mac/install/)
		* Recommended to also have [MacOS Homebrew](https://docs.brew.sh/Installation) installed
			* Use Homebrew to install jq  with `brew install jq`

In your working directory:
	1. clone a copy of the [gaia repo](https://github.com/blockstack/gaia): `git clone -b feature/docker-compose --single-branch https://github.com/blockstack/gaia /gaia`
	2. Change your cwd: `cd gaia/docker`
	3. Set some environment variables in your terminal:
```
$ export LOCAL_DISK="./gaia-storage"
$ export GAIA_DISK_STORAGE_ROOT_DIR="/tmp/gaia-storage"
```
	4. Start the server: `docker-compose up -d`
	5. Verify the server is responding locally:
```
$ curl -s localhost/hub_info | jq
{
	"challenge_text": "[\"gaiahub\",\"0\",\"hub\",\"blockstack_storage_please_sign\"]",
	"latest_auth_version": "v1",
	"read_url_prefix": "http://localhost:80/hub/"
}
```
	6. Optional - test writes to local gaia-hub:
		1. **this is a workaround for MacOS** - `sudo mv /usr/local/include /usr/local/include.save`
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
		* [gaia/README.md at master · blockstack/gaia · GitHub](https://github.com/blockstack/gaia/blob/master/admin/README.md)
```
$ export API_KEY="hello"
$ curl -H "Authorization: bearer $API_KEY" -H 'Content-Type: application/json' -X POST --data-raw '{"serverName": "myserver"}' http://localhost:8009/v1/admin/config
{"message":"Config updated -- you should reload your Gaia hub now."}
$ curl -H "Authorization: bearer $API_KEY" -X POST http://localhost:8009/v1/admin/reload
{"result":"OK"}
```

### Changing the write path from a local disk to a cloud provider
This example will use Digital Oceans Workspaces, documented here:
	* link to docs


#### Securing this installation
It's **highly** recommended that you change the API key for the admin server in the file `admin-config/config.json`, as the default is an easily guessed string `hello`.

Following the above will not secure the gaia hub, and is meant for local testing.
However, it's entirely possible to run this so it's available externally, but you'll be responsible for a few steps to secure it further.
In the future, we'll provide a more automated way to do this, but for now you should be able to follow the instructions here:

	* link 1
	* link 2
	* link 3
	* etc

# Running Gaia Hub from a Cloud Provider
**keys missing from account, will have to fill this in later**
