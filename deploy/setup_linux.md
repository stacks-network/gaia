# Setup a local GAIA hub in Linux

Steps to setup a GAIA hub on a Linux server (fresh install). This example is using Debian, but should work on any Linux distribution. It uses docker compose in the backgroud. 

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

Install *docker-compose* by downloading the [latest-release](https://github.com/docker/compose/releases):

```bash
VERSION_DC=$(curl --silent https://api.github.com/repos/docker/compose/releases/latest | jq .name -r)
DESTINATION_DC=~/.docker/cli-plugins
mkdir -p ${DESTINATION_DC}
curl -SL https://github.com/docker/compose/releases/download/${VERSION_DC}/docker-compose-linux-x86_64 -o ${DESTINATION_DC}/docker-compose
chmod +x ${DESTINATION_DC}/docker-compose
```
**3. Clone the GAIA repository** and enter it's docker directory.

```bash
git clone https://github.com/stacks-network/gaia.git && cd gaia/deploy/docker
```

**4. Copy and edit appropiate .env file**.  
In the folder `./deploy/docker/` they are different sample files for different configurations like using aws, azure or disk among others. In this example we will store the data localy so we will copy the *disk* file and update the domain and email fields. Please change `gaia.site.com` and `gaiarocks@mydomain.com` accordingly. Note you need both for the SSL certificate to be created correctly.

```bash
export MYGAIADOMAIN=gaia.site.com
export MYGAIAEMAIL=gaiarocks@mydomain.com
cp sample-disk.env disk.env
sed -i 's/my-domain.com/'"$MYGAIADOMAIN"'/g' disk.env
sed -i 's/my-email@example.com/'"$MYGAIAEMAIL"'/g' disk.env

```

**5. Start GAIA HUB service**

To start GAIA HUB

```bash
./gaiahub.sh start
```

To stop GAIA HUB

```bash
./gaiahub.sh stop
```

To view GAIA HUB status
```bash
./gaiahub.sh status
```



**6. Verify server works locally** with the following command:
```bash
curl -sk http://localhost/hub_info | jq
```
A correct result should look similar to this:
```bash
    {
      "challenge_text": "[\"gaiahub\",\"0\",\"gaia-0\",\"blockstack_storage_please_sign\"]",
      "latest_auth_version": "v1",
      "max_file_upload_size_megabytes": 20,
      "read_url_prefix": "https://gaia.site.com/reader/"
    }
```

**7. Test your GAIA HUB**
Running `gaia_test.js` will test your GAIA Hub, by trying to connect to it, uploading a file and downloading it again.

First install all required dependencies with:
```bash
npm install
```

Then, from the root folder of the project type:

```bash
node ./deploy/gaia_test.js https://yourgaiaurl
```

A correct result will be something like this:
```
Will run a test for the GAIA HUB: https://gaia.mydomain.com
Generating some test keys...
Private key:  5aacc60fc2a429e1f02be139f3cac82061c6a980********************
Public key:   025691f17f2ab80dc4af363bb9c7aac59e9e1db6ae8ff668202582a3f4ec9678ff
Address:      15n8Xo8acRvSZghJG2dxJ8dCdzDMYicUuS
[DEBUG] connectToGaiaHub: https://gaia.mydomain.com/hub_info
[DEBUG] uploadToGaiaHub: uploading testing.txt to https://gaia.mydomain.com
File uploaded successfully.
Upload to gaia hub thinks it can read it from: https://gaia.mydomain.com/reader/15n8Xo8acRvSZghJG2dxJ8dCdzDMYicUuS/testing.txt
Hub info thinks it can read it from          : https://gaia.mydomain.com/reader/15n8Xo8acRvSZghJG2dxJ8dCdzDMYicUuS/testing.txt
Let's now try to fetch the uploaded file...
File fetched successfully. Contents of file: GAIA ROCKS!
```
