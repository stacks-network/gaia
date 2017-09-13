# Hub

This is an initial implementation of a wrapper around s3. Similar idea to a storage hub. To use have configured s3 credentials in the following form saved at `~/.aws/credentials`

```toml
[default]
aws_access_key_id = <your access key id>
aws_secret_access_key = <your secret key>
```

Run the server and tests with the following commands.

```shell
# Start the server
$ npm run start

# Run the tests
$ npm run test
```

## NOTES:

The requests in this server go through `index.js`. The server is implemented in `server/server.js`. There are 2 classes that handle the request flow. The `S3Driver` contains an instance of the `s3` client from the `aws-sdk`. The `StorageRequest` class provides an easy wrapper over the `(req, res)` to abstract logic from handling write requests

Next thing to implement is a test that contains a proper request and a number of improper ones. Also some work on the authentication logic in `StorageRequest` is still required.
