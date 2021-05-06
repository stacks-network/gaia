# Running a Gaia Hub with docker-compose

Please refer to the [Official Docs](https://docs.stacks.co/storage-hubs/overview.html) for the most up to date instructions.



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

1. Change your cwd:
    ```
    $ cd gaia/docker
    ```

1. Create a copy of sample-disk.env and fill out the values:
    ```
    $ cp sample-disk.env disk.env
    # Update the DOMAIN_NAME and CERTBOT_EMAIL variables to a domain which will host the Gaia Hub,
    # and email you own to request an SSL cert
    ```

1. Start the server:
    ```
    $ docker-compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env up
    ```

1. Verify the server is responding locally:
    ```
    $ curl -s my-domain.com/hub_info | jq
    {
      "challenge_text": "[\"gaiahub\",\"0\",\"hub\",\"blockstack_storage_please_sign\"]",
      "latest_auth_version": "v1",
      "read_url_prefix": "https://my-domain.com/reader/"
    }
    ```

1. Optional - test writes to local gaia-hub:

  ```
  # Update the 'hubUrl' variable in the gaia_test.js file to your local domain
  #
  # Then run docker to install the necessary version of node and dependencies, then run
  $ docker run --rm -ti -v $(pwd)/gaia_test.js:/gaia_test.js node:12 bash -c "npm install blockstack@19.3.0; node gaia_test.js"
  [DEBUG] connectToGaiaHub: https://my-domain.com/hub_info
  [DEBUG] uploadToGaiaHub: uploading foo.txt to https://my-domain.com
  Upload to gaia hub thinks it can read from: https://my-domain.com/reader/18FBCKvm4WVSPNqdT9V11fDDzP1V1Jayg1/foo.txt
  Hub info thinks it can read from: https://my-domain.com/reader/18FBCKvm4WVSPNqdT9V11fDDzP1V1Jayg1/foo.txt
  Contents of file: hello world!
  ```

### Modifying the configuration for your gaia-hub
Two methods exist:
1. Edit the `gaia/deploy/configs/hub-config.json` using `vim` or other
  * requires a restart of the containers: `docker-compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env restart`


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
