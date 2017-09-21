# Hyperledger Fabric Client Wrapper

This is a wrapper over the [Hyperledger Fabric Node SDK](https://github.com/hyperledger/fabric-sdk-node/), that attempts to cover up some of the pain points.

## Node Versions

This has been tested on the following versions of Node: 6.11.3, 8.4.0

## Trying out `fabric-client-wrapper` with `fabric-samples`
[See Here](./E2E_TESTS.md)

## Fabric Client Wrapper Documentation
[See here](./DOCUMENTATION.md)

## Examples

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
