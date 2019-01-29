# Running a Gaia Hub with docker-compose

## MacOS for local testing/development
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
#### DigitalOcean
First, create an account on [digitalocean.com](https://digitalocean.com).

##### Create a Digital Ocean Space

Now that you have a Droplet, you need to create a 'Space', which is where your files will be stored.

In the top right, click the 'Create' dropdown, and now click 'Spaces' at the bottom.

Scroll down to 'Finalize and Create', and give your space a name. This name will be used when reading files that you've stored through Gaia. You'll need to remember this name when you set up your Gaia server later on.

Finally, click 'Create a Space', and your Space will be up and running.

Back in on the Digital Ocean website, click on `API` in the sidebar. Scroll to the bottom of the `Tokens/Keys` section, and click 'Generate New Key' next to 'Spaces access keys'. You'll now have your 'Access Key' and 'Secret Key'. Make sure you store these keys in a secure way, because you won't be able to reference them later on.


##### Gaia Hub Configuration
Now we'll update our gaia hub configuration, and ultimately reload the hub container to effect the changes.
**Important**: You'll have to provide a config valued called `endpoint`. This value will be `myregion.digitaloceanspaces.com`. If your space is in the `sfo2` region, then set the `endpoint` to `sfo2.digitaloceanspaces.com`. Do **not** add `https://` to this URL.

1. export some variables:
```
$ export API_KEY="hello"
$ export AWS_ACCESS_KEY="<hidden access_key>"
$ export AWS_SECRET_KEY="<hidden secret_key>"
$ export ENDPOINT="<region>.digitaloceanspaces.com"
```

2. update the hub driver configuration
```
$ curl -H "Authorization: bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw "{\"driver\": \"aws\", \"awsCredentials\": {\"endpoint\": \"$ENDPOINT\", \"accessKeyId\": \"$AWS_ACCESS_KEY\", \"secretAccessKey\": \"$AWS_SECRET_KEY\"}}" \
http://localhost:8009/v1/admin/config
{"message":"Config updated -- you should reload your Gaia hub now."}
```

3. update proofs configuration:
For the `proofsRequired` section, chance the value to the number `0`. This will allow Blockstack user to write to your Gaia hub, without any social proofs required. You can change this later on, and do other things to lock-down this Gaia hub to just yourself, but that is outside the scope of this document.
```
$ curl -H "Authorization: bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw '{"proofsConfig": {"proofsRequired": 0}}' \
http://localhost:8009/v1/admin/config
{"message":"Config updated -- you should reload your Gaia hub now."}
```

4. reload the hub
```
$ curl -H "Authorization: bearer $API_KEY" \
  -X POST \
http://localhost:8009/v1/admin/reload
```

after a few moments, your gaia hub will again be running






### Securing this installation
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
