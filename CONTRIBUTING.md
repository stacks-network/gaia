# Maintainers

The Gaia repo is currently maintained by Aaron Blankstein (@kantai), and reviewers for PRs include
@jcnelson and @zone117x

# Submitting PRs

A submitted PR must:

1. Describe exactly what the goal of the PR is (and link to any relevant issues)
2. Describe how that goal was achieved through the submitted implementation.
3. The code must obey our eslint definitions, pass our unit tests, and
   contain correct TypeFlow annotations.
4. Contain tests that cover any and all new functionality or code changes.
5. Describe how the new functionality can be tested manually.
6. Document any new features or endpoints, and describe how developers
   would be expected to interact with them.
7. PR authors should agree to our contributor's agreement.

PRs on Gaia should be reviewed by at least (2) maintainers.

Most PRs should be based on the `develop` branch, unless it is a hotfix, in which case
 it should be based on the `master` branch. We prefer that you do not do any squashing on
 your commits (we like to see the whole history of edits).  Maintainers will handle version 
 bumps and updating the `CHANGELOG.md` file.

# Reviewing PRs

A PR reviewer is responsible for ensuring the following:

1. All code changes are covered by automated tests. 
  a. If a driver is changed, tests _must_ cover any changes in both the mocked driver
  tests and with real driver tests using credentials for that driver (if necessary).
  
2. Does this code change invalidate outstanding authentication tokens? If so,
   this is a breaking change, and versioning and release notifications must
   reflect that.

3. Does this code change the way data is written to any existing drivers? If so,
   do tests ensure that the written file data and meta-data (like Content-Type, Cache-Control)
   match exactly what was written previously? If no, why is this breaking change necessary?

4. Does this code change affect any other kinds of behavior in deployed hubs in a
   breaking way? If so, this is a breaking change, and versioning and release notifications
   must reflect that.

5. Does this code change change the typical read/write behavior and expectations of the Gaia
   hub? Under normal usage, a Gaia hub is responsible only for writes.

6. Does the code match our style guidelines as defined by our eslint definitions? Does type
   enforcement need to be disabled in any files?
