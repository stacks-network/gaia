# Hub

This is an initial implementation of a wrapper around s3 and azure for writes. Similar idea to a storage hub. To use copy the configuration file `config.sample.json` and add in your aws and azure credentials. To run the tests have 2 config files:

```
./config.aws.json
./config.azure.json
```


Run the server and tests with the following commands.

```shell
# Start the server
$ npm run start

# Run the tests
$ npm run test
```
