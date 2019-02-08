# Running on AWS
Pre-built AMI is available currently (will change periodically)
  - Name: `Blockstack.Gaia.Hub_1549643256`
  - ID: `ami-04793ff666176c1f3`

### Requirements:
Active AWS account with permissions:
  1. launch an EC2 instance
  2. create/update security-groups


### launch EC2 Instance:
from your [EC2 console](https://us-west-2.console.aws.amazon.com/ec2/v2/home) in the `us-west-2` region (for now):
* Choose "launch instance" - the big blue button
1. Choose AMI:
  - on the left, select "community ami"
  - search for `ami-04793ff666176c1f3`
  - press "select" for the image named "Blockstack.Gaia.Hub_1549643256"

2. Choose an Instance Type
  - select an appropriate instance (t2.micro should be sufficient)

3. Configure Instance Details
  - select the VPC you want to launch this in
    - private VPC/subnets are fine, but you will need to expose it to the internet (more on that later)
    - no IAM role is necessary to run a gaia-hub
    - `Enable termination protection` is recommeneded (so the host will not be deleted on shutdown)
    - press the arrow the left of `Advanced Details` and add the following with your specific environment details as follows:
      1. <DOMAIN_NAME_VALUE>
        - value of your domain name, i.e. `fakedomain.com`
      2. <STAGING_VALUE>
        - "0" to request a valid SSL certificate
        - "1" to request a staging certificate

      ```
      {
        "ignition": { "version": "2.2.0" },
        "storage": {
          "files": [{
            "filesystem": "root",
            "path": "/etc/environment",
            "mode": 420,
            "contents": {
              "source": "data:application/octet-stream,DOMAIN%3D<DOMAIN_NAME_VALUE>%0ASTAGING%3D<STAGING_VALUE>"
            }
          }]
        }
      }
```
4. Add Storage
  - nothing needs to be changed here

5. Add Tags - *Highly recommended but optional*

  Ex:
    - Key: `Name`
    - Value: `yourname-gaia-hub-001`
    - etc

6. Configure Security Group
  1. If you have a security group with the following, use it:
    - TCP port 80 & 443 open to "anywhere" (0.0.0.0/0)
    - TCP port 22 open to "My IP"
  2. If you create a security group, ensure it has the following:
    - Type: SSH
        -  Protocol: TCP
        - Port Range: 22
        - Source: "My IP"
        - Description: optional
    - Type: HTTP
        - Protocol: TCP
        - Port Range: 80
        - Source: "Anywhere"
        - Description: optional
    - Type: HTTPS
        - Protocol: TCP
        - Port Range: 443
        - Source: "Anywhere"
        - Description: optional

7. Review Instance Launch
  - If everything looks good, press the blue "launch" button in the lower right

8. Select a keypair
  - Select an existing keypair that you have access to (typically `~/.ssh/<keypairname.pem`)
  - Or, create a new keypair and download the file it creates for you


9. Once the VM is launching
  - it will either create a public ip (if you selected a public subnet)
    - this is the IP you'll need to add to your domain's dns provider (i.e. freenom)
  - if you're using a private subnet...you'll need to attach an [EIP](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2) to the VM:
    - select an unallocated IP, or press "allocate new address" and follow the instructions to attach the EIP to your new EC2 instance
    - update your domain's DNS to point to the address of this EIP


### Final steps - ** *This is important* **
You should now have:
1. a running EC2 instance
2. a DNS A record pointing your domain to this instnace (or the EIP attached to it)

Now that the instance is started, it's going to perform some initial setup steps behind the scenes that will take a few minutes (usually no more than 5 mins, depending on network speeds).

Mainly, it's going to be pulling down all the docker images specified in the docker-compose files in this repo, and can take a little bit of time to complete.

We do this to ensure that when you start the VM, you're getting the most up to date versions of the image at the time you start the instance.

---
Final Steps:

Run Command: `ssh -t -i <your keyfile.pem> core@<public ip address> "sudo systemctl restart get-acme-certs.service"`
  - ex: `ssh  -t -i ~/.ssh/mykeyfile.pem core@2.3.4.5  "sudo systemctl restart get-acme-certs.service"`

- Alternatively, you can also ssh to the host directly:  `ssh -t -i <your keyfile.pem> core@<public ip address>`
  - certificates will be stored locally in `/gaia/docker/nginx/certbot/conf/live/<domain>`
    - these are localhost only certificates and are not valid
  - run `sudo systemctl restart get-acme-certs.service` to generate valid certificates
    - if STAGING env is set to `1` above, this will generate a STAGING certificate
    - you can `sudo systemctl restart get-acme-certs.service` at anytime to regenerate the certs
      - edit the envfile: `vi /etc/environment`, changing it to `STAGING=1` and rerun the above command
* This command will take a little while to run, but if everything is successful  you should now be able to visit your site:

`https://<domain>` - *this is a blank page*

`https://<domain>/hub_info` - *this will display your hub info*


* you're now ready to complete config of your specific gaia-hub...
