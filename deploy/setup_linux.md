# Setup a local GAIA hub with docker-compose on Linux

Steps to setup a GAIA hub on a Linux server (fresh install). This example is using Debian 11, but should work on any Linux distribution.  

This configuration will setup the following 4 docker containers:

* Nginx with certbot on TCP ports 80 and 443.
* Gaia hub on TCP port 3000.
* Gaia admin on TCP port 8009.
* Gaia reader on TCP port 8008

**1. Update the system and install the dependencies and software we will use to test:**

```bash
apt update && apt upgrade -y && apt install -y git vim gnupg jq
```

**2. Install [docker](https://docs.docker.com/engine/install/debian/) and [docker-compose](https://docs.docker.com/compose/cli-command/#install-on-linux)** in your OS.  
For our example we install *docker* with:
```bash
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update && apt install -y docker-ce docker-ce-cli containerd.io
```

Install *docker-compose* by downloading the [latest-release](https://github.com/docker/compose/releases), which at the moment of this writing its v.2.2.3:

```bash
mkdir -p ~/.docker/cli-plugins/
curl -SL https://github.com/docker/compose/releases/download/v2.2.3/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```
**3. Clone the GAIA repository** and enter it's docker directory.

```bash
git clone https://github.com/stacks-network/gaia.git && cd gaia/deploy/docker
```

**4. Copy and edit appropiate .env file**.  
In the folder ./deploy/docker/ they are different sample files for different configurations like using aws, azure or disk among others. In this example we will store the data localy so we will copy the *disk* file and update the domain and email fields. Please change `gaia.site.com` and `gaiarocks@mydomain.com` accordingly. Note you need both for the SSL certificate to be created correctly.

```bash
export MYGAIADOMAIN=gaia.site.com
export MYGAIAEMAIL=gaiarocks@mydomain.com
cp sample-disk.env disk.env
sed -i 's/=my-domain.com/='"$MYGAIADOMAIN"'/g' disk.env
sed -i 's/my-email@example.com/'"$MYGAIAEMAIL"'/g' disk.env

```

**5. Start Server**
```bash
docker compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env up -d
```

**6. Verify server works locally** with the following command:
```bash
curl -sk https://localhost/hub_info | jq
```
An correct result should look similar to this:
```bash
    {
      "challenge_text": "[\"gaiahub\",\"0\",\"gaia-0\",\"blockstack_storage_please_sign\"]",
      "latest_auth_version": "v1",
      "max_file_upload_size_megabytes": 20,
      "read_url_prefix": "https://gaia.site.com/reader/"
    }
```
