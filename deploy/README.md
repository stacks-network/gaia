# Running a Gaia Hub with docker-compose

Please refer to the [Official Docs](https://docs.stacks.co/storage-hubs/overview.html) for the most up to date instructions.



## MacOS for local testing/development

The following assumes you have [Docker Installed](https://docs.docker.com/docker-for-mac/install/)
* Recommended to also have [MacOS Homebrew](https://docs.brew.sh/Installation) installed
* Use Homebrew to install jq  with `brew install jq`

In your working directory:
1. clone a copy of the [gaia repo](https://github.com/stacks-network/gaia):
    ```
    $ git clone \
          -b master \
          --single-branch \
          https://github.com/stacks-network/gaia \
      gaia
    ```

1. Change your cwd:
    ```
    $ cd gaia/docker
    ```

1. Create a copy of sample-disk.env and fill out the values:
    ```
    $ cp sample-disk.env disk.env
    # Update the DOMAIN_NAME variable to `localhost`
    ```

1. Start the server:
    ```
    $ docker-compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env up
    ```

1. Verify the server is responding locally:
    ```
    $ curl -sk https://localhost/hub_info | jq
      {
        "challenge_text": "[\"gaiahub\",\"0\",\"gaia-0\",\"blockstack_storage_please_sign\"]",
        "latest_auth_version": "v1",
        "max_file_upload_size_megabytes": 20,
        "read_url_prefix": "https://localhost/reader/"
      }
    ```

### Modifying the configuration for your gaia-hub
Two methods exist:
1. Edit the `gaia/deploy/configs/hub-config.json` using `vim` or other
  * requires a restart of the containers: `docker-compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env restart`


2. Use the running `admin` container to modify any config values, and also reload the hub when complete:
  - [GitHub - Gaia Admin README.md](https://github.com/stacks-network/gaia/blob/master/admin/README.md)

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
