# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
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
