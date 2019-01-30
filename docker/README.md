# Running a Gaia Hub with docker-compose

## MacOS for local testing/development

The following assumes you have [Docker Installed](https://docs.docker.com/docker-for-mac/install/)
* Recommended to also have [MacOS Homebrew](https://docs.brew.sh/Installation) installed
* Use Homebrew to install jq  with `brew install jq`

In your working directory:
1. clone a copy of the [gaia repo](https://github.com/blockstack/gaia):
  - `git clone -b feature/docker-compose --single-branch https://github.com/blockstack/gaia /gaia`

2. Change your cwd:
  - `cd gaia/docker`

3. Set some environment variables in your terminal:
```
$ export LOCAL_DISK="./gaia-storage"
$ export GAIA_DISK_STORAGE_ROOT_DIR="/tmp/gaia-storage"
```

4. Start the server:
  - `docker-compose up -d`

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

  a. **this is a workaround for MacOS**
    - `sudo mv /usr/local/include /usr/local/include.save`

  b. `npm install blockstack`

  c. ` sudo mv /usr/local/include.save /usr/local/include`

  d. `node gaia_test.js`
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
$ curl -H "Authorization: bearer $API_KEY" -H 'Content-Type: application/json' -X POST --data-raw '{"serverName": "myserver"}' http://localhost:8009/v1/admin/config
{"message":"Config updated -- you should reload your Gaia hub now."}
$ curl -H "Authorization: bearer $API_KEY" -X POST http://localhost:8009/v1/admin/reload
```

### Changing the write path from a local disk to a cloud provider

#### DigitalOcean

First, create an account on [digitalocean.com](https://digitalocean.com).

##### Create a Digital Ocean Space

[Doc Source](https://github.com/moxiegirl/docs.blockstack/blob/gaia-check/_storage/digital-ocean-deploy.md#task-1-create-a-digitalocean-space)

In this task you create a 'Space' which is where your files will be stored.

1. Choose **Create > Spaces** from the dashboard menu.

2. Enter a space name.

3. Scroll down to **Finalize and Create**.

4. Enter a space name.

   This name will be used when reading files that you've stored through Gaia. You'll need to remember this name when you set up your Gaia server later on.

5. Click **Create a Space**.

   After a moment, your Space is up and running.

6.  Copy the section of your space URL that follows the name.

    ![Space endpoint](https://github.com/moxiegirl/docs.blockstack/blob/gaia-check/_storage/images/space-endpoint.png)

    In this example, you would copy the `sfo2.digitaloceanspaces.com` section.

##### Create a space key

[Doc Source](https://github.com/moxiegirl/docs.blockstack/blob/gaia-check/_storage/digital-ocean-deploy.md#task-4-create-a-space-key)

1. In the DigitalOcean dashboard, go to the **API** page.
2. Scroll to the **Spaces Access Keys** section.
3. Click **Generate New Key**.

   The system prompts you to give the key a name.

4. Enter a name for the key.

   It is helpful to choose descriptive name like `gaia-hub-key`.

5. Press the check mark.

    The system creates your key and displays both the key and its secret.

    ![Access key](https://github.com/moxiegirl/docs.blockstack/blob/gaia-check/_storage/images/space-access-key.png)

6. Save your secrete in a secure password manager.

    **You should never share your secret.**


##### Gaia Hub Configuration

Now we'll update our gaia hub configuration, and ultimately reload the hub container to effect the changes.

**Important**: You'll have to provide a config valued called `endpoint`, which was retrieve above.

This value will be similar to `<region>.digitaloceanspaces.com`.

If your space is in the `sfo2` region, then set the `endpoint` to `sfo2.digitaloceanspaces.com`.

*Do **not** add `https://` to this URL.*

1. Export some Environment Variables:
```
$ export API_KEY="hello"
$ export AWS_ACCESS_KEY="<hidden access_key>"
$ export AWS_SECRET_KEY="<hidden secret_key>"
$ export ENDPOINT="<region>.digitaloceanspaces.com"
```

2. Update the hub driver configuration
```
$ curl -H "Authorization: bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw "{\"driver\": \"aws\", \"awsCredentials\": {\"endpoint\": \"$ENDPOINT\", \"accessKeyId\": \"$AWS_ACCESS_KEY\", \"secretAccessKey\": \"$AWS_SECRET_KEY\"}}" \
http://localhost:8009/v1/admin/config
```

3. Update proofs configuration:
For the `proofsRequired` section, chance the value to the number `0`.
This will allow Blockstack user to write to your Gaia hub, without any social proofs required. You can change this later on, and do other things to lock-down this Gaia hub to just yourself, but that is outside the scope of this document.
```
$ curl -H "Authorization: bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -X POST \
  --data-raw '{"proofsConfig": {"proofsRequired": 0}}' \
http://localhost:8009/v1/admin/config
```

4. Verify your configuration settings:
```
$ curl -H "Authorization: bearer $API_KEY" \
http://localhost:8009/v1/admin/config | jq
```

5. Reload your Gaia Hub
```
$ curl -H "Authorization: bearer $API_KEY" \
  -X POST \
http://localhost:8009/v1/admin/reload
```

After a few moments, your gaia hub will again be running.






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


# firewall/security-group settings
- only open ports required (80/443/etc)
- admin port should  only be available by localhost (ssh to server for now)

# ssl setup
- add another image to the docker-compose, for cert-manager
- need a way to get the domain from a user (EC2 tag?)
  - requires an IAM Role in AWS to retrieve the tag (ec2:describe-tags policy)
