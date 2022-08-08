# Gaia Reader Side-car

This module implements an HTTP GET endpoint for data stored with Gaia via the
local disk driver.  This is necessary since unlike other cloud-based storage
systems, local disks do not have built-in HTTP servers.

## How To Build

To build, run:

```bash
$ npm install
$ npm run build
```

To install, run:

```bash
$ sudo npm install # or, `sudo npm link`
```

This should install `blockstack-gaia-reader` to your `$PATH`.

## How To Use

To use, first create a configuration file that indiciates (1) what port to
bind on, and (2) where to load the files the Gaia hub stored.  Example:

**JSON**

```
$ cat /etc/gaia-reader.conf
{
   "port": 4001,
   "diskSettings": {
      "storageRootDirectory": "/var/gaia/disk"
   }
}
```

**TOML**

```
$ cat /etc/gaia-reader.conf
port = 4001

[diskSettings]
storageRootDirectory = "/var/gaia/disk"
```

Then, run the Gaia hub reader with the config file:

```bash
$ blockstack-gaia-reader /etc/gaia-reader.conf
```

It will begin serving files out of the directory indicated in
`storageRootDirectory`, and will listen on the given `port`.

## Deployment Notes

The Gaia read side-car needs to service GET requests on URLs that start with
your Gaia hub's read URL.  You can determine your Gaia hub's read URL by either
looking for the `readURL` key in your Gaia hub's config file, or by looking for
the `read_url_prefix` field in the data returned by a `GET /hub_info` on your
Gaia hub.

We recommend running an nginx proxy in front of the reader side-car, in order to
do things like rate-limiting and SSL termination.  If you do this, make sure
that nginx services requests on your Gaia hub's expected read URL.
