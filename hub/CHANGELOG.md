# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
