# Hyperledger Fabric Client Wrapper

This is a wrapper over the Hyperledger Fabric Node SDK, that attempts to cover up some of the painpoints.

## Software Versions

This has been tested on the following versions:

| software| version  |
|---------|----------|
| node |  v6.11.3, v8.4.0  |
| npm | 3.10.10, v5.3.0 |
| fabric-client | 1.0.2 |
| fabric-ca-client | 1.0.2 |


## Trying out `fabric-client-wrapper` with `fabric-samples`

In the `test/fixtures/network-configs/` folder we have sample `config` files.
```
test/fixtures/network-configs/
└── first-network.json
```

The `first-network.json` file works with the setup in
[fabric-samples](https://github.com/hyperledger/fabric-samples). To try it out
follow these instructions:

Clone the `fabric-samples` directory in the base level of the `harness`
   directory.
```
fabric-client-wrapper$ git clone https://github.com/hyperledger/fabric-samples
```

Go to the `first-network` example. Build it following the instructions in
`fabric-samples`; for more details on [fabric-samples](https://github.com/hyperledger/fabric-samples), [see here](./FABRIC_SAMPLES.md).
Bringup the network in this example via `docker-compose`, for
instance
```
first-network$ docker-compose -f docker-compose-e2e.yaml up
```

Install the `npm packages` to setup `hfbench-harness-nodejs`.
```
fabric-client-wrapper$ npm install
```

Run the `hfbench-harness-nodejs` e2e script to configure the network.
```
fabric-client-wrapper$ npm run e2e
```


## Other NPM Commands

These are a few functions that are available (or planned).
All instructions are to be executed in the `client` directory (i.e. in the same
directory as the `package.json` file)

To run unit tests
```
fabric-client-wrapper$ npm run test
```

To serve a documentation website via `documentation.js`
```
fabric-client-wrapper$ npm i -g documentation.js
fabric-client-wrapper$ npm run serve-doc
```

## Usage

### Create a configuration object for an organization
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from '@blockchain/fabric-client-wrapper'

async function init() {
    const mspId = 'Org1MSP'
    const keystorePath = path.join(__dirname, 'keystore')
    const organizationConfig = await fcw.createFileKeyValueStoreOrganizationConfig(
        mspId,
        keystorePath
    )
}

init()
```

### Load a user from a public/private key pair
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from '@blockchain/fabric-client-wrapper'

async function init() {
    const organizationConfig = ...
    const privateKeyPath = path.join(__dirname, './123_sk')
    const publicKeyPath = path.join(__dirname, './123.pem')
    const privateKeyPEM = fs.readFileSync(privateKeyPath).toString()
    const signedCertPEM = fs.readFileSync(publicKeyPath).toString()
    const gregClient = await createUserClientFromKeys(
        {
            username,
            cryptoContent: {
                privateKeyPEM,
                signedCertPEM,
            },
        },
        organization.config
    )
}

init()
```

### Load a user from the CA
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from '@blockchain/fabric-client-wrapper'

async function init() {
    const organizationConfig = ...
    const fabricCAClient = fcw.createFabricCAClient(
        'https://localhost:7054',
        organizationConfig
    )
    const bobClient = await fcw.createUserClientFromCAEnroll(
        fabricCAClient,
        {
            username: 'bob',
            secret: 'password123',
        },
        organizationConfig
    )
}

init()
```

### Create a new channel object
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from '@blockchain/fabric-client-wrapper'
import Orderer from 'fabric-client/lib/Orderer'

async function init() {
    const gregClient = ...
    const peers = [
      gregClient.createEventHubPeer(
          'grpcs://localhost:7051',
          'grpcs://localhost:7053',
          {
              pem: fs.readFileSync(path.join(__dirname, './peer1.pem')).toString(),
              ssl-target-name-override: 'peer0.org1.example.com'
          }
      )
    ]
    await Promise.all(peers.map(peer => peer.waitEventHubConnected()))

    const orderer = new Orderer(
        'grpcs://localhost:7050',
        {
            pem: fs.readFileSync(path.join(__dirname, './orderer.pem')).toString(),
            ssl-target-name-override: 'orderer.example.com'
        }
    )

    const channelName = 'mychannel'
    const channel = new fcw.FcwChannel({
        client: gregClient,
        channelName,
        peers,
        orderer
    })
    await channel.initialize()
    // OR
    // const channel = await fcw.setupChannel(gregClient, { channelName, peers, orderer }).run()
}

init()
```

### Setup a channel+chaincode on the network
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from '@blockchain/fabric-client-wrapper'

async function init() {
    const gregClient = ...
    const channel = ...
    const channelTxPath = path.join(__dirname, './channel.tx')
    const channelEnvelope = fs.readFileSync(channelTxPath)
    const chaincodeId = 'awesomecc'
    const chaincodePath = 'github.com/my_awesome_cc'
    const chaincodeVersion = 'v1'
    await fcw.setupChannel(gregClient, channel)
      .withCreateChannel({ channelEnvelope })
      .withJoinChannel()
      .withInstallChaincode({ chaincodeId, chaincodePath, chaincodeVersion })
      .withInstantiateChaincode({
          {
              chaincodeId,
              chaincodeVersion,
              fcn: 'init',
              args: ["a", "100", "b", "200"],
          }
      )
      .run()
}

init()
```

### Perform an invoke+query
```JavaScript
import fcw from '@blockchain/fabric-client-wrapper'

async function init() {
    const gregClient = ...
    const channel = ...
    const transactor = fcw(gregClient, channel, 'awesomecc')
    const invokeResponse = await transactor.invoke('move', ['a', 'b', '10'])
    const queryResponse = await transactor.query('query', ['a'])
}

init()
```

## Fabric Client Wrapper Documentation

[See here](./DOCUMENTATION.md)
