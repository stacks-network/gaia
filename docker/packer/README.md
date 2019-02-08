# Building gaia-hub AMI


### Requirements
- [Get Packer](https://www.packer.io/downloads.html)
- [Packer docs](https://www.packer.io/docs/index.html)
- [AWS Cli](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
- [AWS API Keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
* IAM user should have the following permissions enabled in an IAM Policy for `packer build` to run correctly:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PackerEC2",
            "Effect": "Allow",
            "Action": [
                "ec2:AttachVolume",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CopyImage",
                "ec2:CreateImage",
                "ec2:CreateKeypair",
                "ec2:CreateSecurityGroup",
                "ec2:CreateSnapshot",
                "ec2:CreateTags",
                "ec2:CreateVolume",
                "ec2:DeleteKeypair",
                "ec2:DeleteSecurityGroup",
                "ec2:DeleteSnapshot",
                "ec2:DeleteVolume",
                "ec2:DeregisterImage",
                "ec2:DescribeImageAttribute",
                "ec2:DescribeImages",
                "ec2:DescribeInstances",
                "ec2:DescribeRegions",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSnapshots",
                "ec2:DescribeSubnets",
                "ec2:DescribeTags",
                "ec2:DescribeVolumes",
                "ec2:DetachVolume",
                "ec2:GetPasswordData",
                "ec2:ModifyImageAttribute",
                "ec2:ModifyInstanceAttribute",
                "ec2:RegisterImage",
                "ec2:RunInstances",
                "ec2:StopInstances",
                "ec2:TerminateInstances"
            ],
            "Resource": "*"
        }
    ]
}
```


### Build Image
Rename vars.json.sample to vars.json: `$ mv vars.json.sample vars.json`

1. First, edit the var.json file:
```
{
  "name_prefix": "<what to call your ami>",
  "region": "<region>",
  "profile": "<aws cli profile>",
  "name_prefix": "<Name Prefix of the AMI>",
  "version": "<some random identifier. epoch for example",
  "vpc_id": "<your VPC ID>",
  "subnet_id": "<a public subnet in the above VPC>",
  "user_data_file": "<ignition file to use>",
  "build_type": "<packer build type>"
}
```
example:
```
{
  "name_prefix": "Blockstack.Gaia.Hub",
  "region": "us-west-2",
  "profile": "blockstack",
  "version": "1549643256",
  "vpc_id": "vpc-xxxxxxxx",
  "subnet_id": "subnet-xxxxxxxx",
  "user_data_file": "gaia.ign",
  "build_type": "amazon-ebs"
}
```

2. Run the packer build process: `$ packer build -var-file=vars.json gaia-hub.json`

  Sample output:
  ```
  $ packer build --var-file=vars.json gaia-hub.json
  amazon-ebs output will be in this color.

  ==> amazon-ebs: Prevalidating AMI Name: Blockstack.Gaia.Hub_1549643256
      amazon-ebs: Found Image ID: ami-048789452aff936df
  ==> amazon-ebs: Creating temporary keypair: packer_xxxxxxxxxxxxxxxxxx
  ==> amazon-ebs: Creating temporary security group for this instance: packer_xxxxxxxxxxxxxxxxxx
  ==> amazon-ebs: Authorizing access to port 22 from 0.0.0.0/0 in the temporary security group...
  ==> amazon-ebs: Launching a source AWS instance...
  ==> amazon-ebs: Adding tags to source instance
      amazon-ebs: Adding tag: "Name": "Packer Builder"
      amazon-ebs: Instance ID: i-xxxxxxxxxxxxxxxxxx
  ==> amazon-ebs: Waiting for instance (i-xxxxxxxxxxxxxxxxxx) to become ready...
  ==> amazon-ebs: Waiting for SSH to become available...
  ==> amazon-ebs: Connected to SSH!
  ==> amazon-ebs: Provisioning with shell script: /var/folders/py/xmmlw2997jnf1mdw3pf4l5fm0000gp/T/packer-shell992840895
      amazon-ebs: ** Shreding sensitive data ...
      amazon-ebs: shred: '/home/core/.*history': failed to open for writing: No such file or directory
  ==> amazon-ebs: Stopping the source instance...
      amazon-ebs: Stopping instance, attempt 1
  ==> amazon-ebs: Waiting for the instance to stop...

  ==> amazon-ebs: Creating the AMI: Blockstack.Gaia.Hub_1549643256
      amazon-ebs: AMI: ami-04793ff666176c1f3
  ==> amazon-ebs: Waiting for AMI to become ready...
  ==> amazon-ebs: Adding tags to AMI (ami-04793ff666176c1f3)...
  ==> amazon-ebs: Tagging snapshot: snap-xxxxxxxxxxxxxxxxxx
  ==> amazon-ebs: Tagging snapshot: snap-xxxxxxxxxxxxxxxxxx
  ==> amazon-ebs: Creating AMI tags
      amazon-ebs: Adding tag: "BuildTime": "1549643829"
      amazon-ebs: Adding tag: "Version": "1549643256"
      amazon-ebs: Adding tag: "OS": "CoreOS Stable"
      amazon-ebs: Adding tag: "Name": "Blockstack.Gaia.Hub_1549643256"
      amazon-ebs: Adding tag: "BuildType": "Multiple Disk"
      amazon-ebs: Adding tag: "BuildMethod": "Packer"
  ==> amazon-ebs: Creating snapshot tags
  ==> amazon-ebs: Terminating the source AWS instance...
  ==> amazon-ebs: Cleaning up any extra volumes...
  ==> amazon-ebs: No volumes to clean up, skipping
  ==> amazon-ebs: Deleting temporary security group...
  ==> amazon-ebs: Deleting temporary keypair...
  Build 'amazon-ebs' finished.

  ==> Builds finished. The artifacts of successful builds are:
  --> amazon-ebs: AMIs were created:
  us-west-2: ami-04793ff666176c1f3
  ```

Once the process is complete, you will have an AMI in your account as noted above: `us-west-2: ami-04793ff666176c1f3`


### Ignition
[Ignition Docs](https://coreos.com/ignition/docs/latest/)

The image being built is based off of CoreOS Stable, with all adjustments being made via ignition in the `gaia.ign` file.

The main points in this file are:
1. Directories created:
  - /opt/bin
  - /etc/sysctl.d
  - /etc/motd.d


2. Files created:
  - /etc/coreos/update.conf
  - /etc/docker/docker.json # used for DNS purposes, currently point to Google DNS
  - /etc/vim/vimrc.local
  - /etc/motd.d/default.conf
  - /etc/modules-load.d/nf.conf
  - /etc/sysctl.d/startup.conf # for OS Tuning/Security


3. Disks:
  - /dev/xvdf created as Label:`STORAGE` with XFS filesytem


4. systemd units:
  - docker-tcp.socket
    - enables docker TCP socket
  - gaia-docker-storage.mount
    - mounts the /dev/xvdf disk at `/gaia/docker/storage`
  - install-docker-compose.service
    - determines the latest release of `docker-compose` and installs it to `/opt/bin/docker-compose`
  - pull-gaia-repo.service
    - pulls a single branch (current `feature/docker-compose`) to `/gaia`
  - gaia-hub.service
    - starts the gaia-hub containers via docker-compose
    - calls the script `/gaia/docker/nginx/certbot/letsencrypt-init.sh`
  - get-acme-certs.service
    - creates production certs once DNS is resolving
    - calls the script `/gaia/docker/nginx/certbot/letsencrypt.sh`
    - this service is designed to be run manually, and should only need to run once
