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
  "ami_regions": "<EC2 Regions to store the AMI in>",
  "profile": "<aws cli profile>",
  "vpc_id": "<your VPC ID>",
  "subnet_id": "<a public subnet in the above VPC>",
  "root_volume_size": "<root volume size in GB>"
  "ami_description": "Description",
  "aws_ssh_username": "admin"
}
```
example:
```
{
  "name_prefix": "hiro-private-testnet",
  "region": "us-east-1",
  "ami_regions": "ap-northeast-1,ap-northeast-2,ap-south-1,ap-southeast-1,ap-southeast-2,ca-central-1,eu-central-1,eu-west-1,eu-west-2,eu-west-3,sa-east-1,us-east-1,us-east-2,us-west-1,us-west-2",
  "profile": "default",
  "vpc_id": "vpc-xxxxxxxx",
  "subnet_id": "subnet-xxxxxxxx",
  "root_volume_size": "50",
  "ami_description": "Hiro Private Stacks Testnet",
  "aws_ssh_username": "admin"
}

```

2. Run the packer build process (ex): 
```bash
$ VERSION=$(curl -sL https://api.github.com/repos/stacks-network/gaia/tags | jq .[0].name | tr -d '"v')
$ packer build --var-file=vars.json --var "version=${VERSION}" gaia.json
```
