#### User Data Contents
Replace the following:
1. <DOMAIN_NAME_VALUE>
  - value of your domain name, i.e. `fakedomain.com`
2. <STAGING_VALUE>
  - "0" to request a valid SSL certificate
  - "1" to request a staging certificate
3. <EMAIL_ADDRESS_VALUE> - *optional*

```
{
  "ignition": { "version": "2.2.0" },
  "systemd": {
    "units": [
      {
        "dropins": [
          {
            "contents": "[Service]\nExecStartPost=/bin/sh /gaia/docker/letsencrypt.sh",
            "name": "10-gaia-hub.ssl"
          }
        ],
        "name": "gaia-hub.service"
      }
    ]
  },
  "storage": {
    "files": [{
      "filesystem": "root",
      "path": "/etc/environment",
      "mode": 420,
      "contents": {
        "source": "data:text/plain;charset=utf-8,DOMAIN%3D<DOMAIN_NAME_VALUE>%0D%0ASTAGING%3D<STAGING_VALUE>%0D%0AEMAIL%3D<EMAIL_ADDRESS_VALUE>"
      }
    }]
  }
}
```
