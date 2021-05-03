#!/bin/sh

echo === Installing pre-requisites for Docker ===
sudo apt-get update
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

echo === Downloading Docker GPG keyring ===
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo === Adding Docker repo to apt sources ===
echo \
    "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo === Installing Docker ===
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io
echo === Docker Install Done ===