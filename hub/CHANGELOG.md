# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Support for scoped authentication tokens via a new `scopes` field in
  the authentication JSON web token.
- Configuration via environment variables. See the file `envvars.md` for
  a listing.
### Changed
- The S3 and GCP drivers now respect the Cache-Control setting (the Azure
  driver already did).

## [2.2.1]
### Changes
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
