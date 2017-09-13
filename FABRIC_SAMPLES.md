## Fabric-Samples

There now exists a `fabric` repository that contains examples. We can use a
specific example `first-network` like so:

1. Download the `fabric-samples` into the `hfbench` top directory:
```
hfbench$ git clone https://github.com/hyperledger/fabric-samples
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
   Make sure to build `configtxgen` and `cryptogen` for the fabric release (obtain by following instructions here http://hyperledger-fabric.readthedocs.io/en/latest/samples.html#download-platform-specific-binaries), and
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
