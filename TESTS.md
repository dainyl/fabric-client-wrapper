# Running Tests

1. Build `configtxlator` for the fabric release (obtain by following instructions here http://hyperledger-fabric.readthedocs.io/en/latest/samples.html#download-platform-specific-binaries)

2. Bring up the `configtxlator` which was downloaded in the platform-specific-binaries via:
```
bin$ ./configtxlator start
```

3. Back in the root fabric-client-wrapper directory you should now be able to run the e2e tests

```
fabric-client-wrapper$ npm install
fabric-client-wrapper$ npm test
```
