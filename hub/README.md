# Hub

This is an initial implementation of a wrapper around s3 and azure for gaia writes. To get started with the `hub` run the following:

```bash
$ git clone git@github.com:blockstack/gaia.git
$ cd gaia/hub/
$ npm install
$ cp ./config.sample.json ./config.json
# Edit the config file and add in your azure or aws credentials
$ npm run start
```

### Deploy the Hub

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
  "read_url_prefix": "https://{{ .bucketName }}.{{ .storageProviderUrl }}/user_"
}
```

### Run the tests

To run the tests have one config file for each storage provider you would like to test:

```bash
cat ./config.aws.json
...
"driver": "aws",
...
cat
./config.azure.json
...
"driver": "azure",
...
```

This also provides an easy way to test your storage provider credentials and setup. If your tests fail the first time that may be because the bucket setup did not complete before the test exited. Wait a minute and try the `npm run test` command again.

To configure the logging set the `argsTransport` fields in the config file. Here is a list of [logging configuration options](https://github.com/winstonjs/winston/blob/master/docs/transports.md).
