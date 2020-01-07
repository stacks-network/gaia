# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.0]
### Added
- Return ETag in response body of all requests.
- Read ETag value from If-Match request header and conditionally approve
  write requests if the value is up to date for optimistic concurrency control.
- Read the If-None-Match request header to conditionally approve a file overwrite.
- New explicit error for requests that fail to provide an up to date ETag in
  the If-Match header (412 Precondition Failed Error), or an `*` in the If-None-Match
  header.
### Changed
- Updated DriverModel's WriteResult type to include ETag.

## [2.7.0]
### Added
- Support for running an `https` server by providing the TLS/SSL certs. 
- Support for running an `https` server with Automatic Certificate Management 
  Environment (ACME) via `Let's Encrypt (TM)`. 
### Changed
- Modify the default `cacheControl` setting from `public, max-age=1` to `no-cache`.

## [2.6.0]
### Added
- Implemented the `putFileArchival` restrictive auth scope which causes any 
  file modifications such as `POST /store/...` or `DELETE /delete/...` to 
  "backup" the original file by using a historical naming scheme. For example, 
  a file write to `{address}/foo/bar/photo.png` will cause the original
  file, if it exists, to be renamed to 
  `{address}/foo/bar/.history.{timestamp}.{guid}.photo.png`. 
- The `/list-files/${address}` endpoint now returns file metadata 
  (last modified date, content length) if the `POST` body contains 
  a `stat: true` option. 
- Implemented `readFile` and `fileStat` methods on all drivers, however, 
  these are not yet in use or publicly exposed via any endpoints. 
- The max file upload size is configurable and reported in `GET /hub_info`. 
### Changed
- Concurrent requests to modify a resource using the `/store/${address}/...`
  or `/delete/${address}/...` endpoints are now always rejected with a 
  `HTTP 409 Conflict` error. Previously, this was undefined behavior
  that the back-end storage drivers dealt with in different ways. 
- The `Access-Control-Max-Age` header for preflight CORs OPTION responses
  set to 24 hours. 


## [2.5.3]
### Fixed
- LRUCache count evictions is no longer overestimated. 

## [2.5.2]
### Fixed
- Concurrent writes to the same file using the Azure driver now returns
  error 409 Conflict rather than 500 Internal Server Error. 

## [2.5.1]
### Fixed
- Use regular (non-ts) node invocation on `npm run start`

## [2.5.0]
### Added
- Added support for deleting files using HTTP DELETE requests to the
  `/delete/${address}/${path}` endpoint. This includes new scopes 
  `deleteFile` and `deleteFilePrefix` which work the same way as their 
  `putFile` equivalents. 
- Added support for revoking authentication tokens. Uses the JWT `iat`
  (issued-at date) field in the token and a new `/revoke-all/${bucket}` 
  endpoint that invalidates tokens issued before the given date. 
### Changed
- Repository is now built using Typescript

## [2.3.3]
### Fixed
- Errors which previously caused 500s now correctly result in 4xx errors
  in the event of validation failures.

## [2.3.0]
### Added
- Support for scoped authentication tokens via a new `scopes` field in
  the authentication JSON web token.
- Configuration via environment variables. See the file `envvars.md` for
  a listing.
### Changed
- The S3 and GCP drivers now respect the Cache-Control setting (the Azure
  driver already did).

## [2.2.2]
### Added
- Reader service for serving reads for a disk-backed Gaia hub. This
  respects Content-Type metadata.

## [2.2.1]
### Changed
- Allow multiple cases in "bearer" authentication prefix.

## [2.2.0]
### Added
- Option for requiring that a client supply a `hubURL` claim in their
  authentication payload.
- List files endpoint for authenticated users to list all the contents
  of a given bucket.
- Support for association tokens in authentication to interact with white
  lists.

## [2.1.0]
### Changed
- The `readURL` config parameter is now treated consistently by the
  backend drivers. Previously, drivers like the azure driver used
  the readURL as a _domain_, while others used it as the read URL
  prefix directly. This change will require an update to your config
  file if you used the azure driver -- `server.com` would need to be
  changed to `https://server.com/${bucket}`

## [2.0.0]
### Added
- Support for `v1` authentication scheme. This allows authentication
  with a JWT (ES256K is only supported signing scheme for now), the
  pubkey hex in the field `iss` must match the address of the bucket,
  and must have signed the JWT. More details in
  the [readme](../README.md#v1-authentication-scheme).

## [1.1.0]
### Added
- Backend driver for google cloud storage: Thanks to @stern0 for the PR!

### Changed
- Enabled flow enforcement throughout the source code
