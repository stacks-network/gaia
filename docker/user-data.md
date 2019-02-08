#### User Data Contents
Replace the following:
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
