# E2E tests

## Fabric-Samples Setup
In the `test/fixtures/network-configs/` folder we have sample `config` files.
```
test/fixtures/network-configs/
└── first-network.json
```

The `first-network.json` file works with the setup in
[fabric-samples](https://github.com/hyperledger/fabric-samples). To setup, follow the instructions below

1. Download the `fabric-samples` into the `fabric-client-wrapper` directory:
```
fabric-client-wrapper$ git clone https://github.com/hyperledger/fabric-samples
```

This builds a directory structure like this; each directory is an example.
```
.
├── balance-transfer
├── basic-network
├── chaincode-docker-devmode
├── fabcar
├── first-network   # focus on this
```

2. Go into the `first-network` directory. There is a script `byfn.sh` which
   we will use to build examples with their certificates and crypto-material for a channel named `mychannel`.
   Make sure to build `configtxgen`, `cryptogen`, and `configtxlator` for the fabric release (obtain by following instructions here http://hyperledger-fabric.readthedocs.io/en/latest/samples.html#download-platform-specific-binaries), and
   to have these executables on the `PATH`.
```
first-network$ ./byfn.sh -m generate -c mychannel
```

This generates the files like so:
```
.
├── docker-compose-e2e.yaml
├── crypto-config/                   # certificates
├── channel-artifacts/               # blocks, and bootstraps
├── crypto-config.yaml
├── configtx.yaml
```

3. Bring up the network using the `docker-compose-e2e.yaml`
```
first-network$ docker-compose -f docker-compose-e2e.yaml up
```

4. Bring up the `configtxlator` which was downloaded in the platform-specific-binaries via:
```
first-network$ configtxlator start
```

## Running Tests
Back in the root fabric-client-wrapper directory you should now be able to run the e2e tests

```
fabric-client-wrapper$ npm install
fabric-client-wrapper$ npm run e2e
```
