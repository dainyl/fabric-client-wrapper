# Hyperledger Fabric Client Wrapper

This is a wrapper over the [Hyperledger Fabric Node SDK](https://github.com/hyperledger/fabric-sdk-node/), that simplifies setting up the network and making transactions

## Node Versions

Node runtime version 6.9.x or higher, and 8.4.0 or higher ( Node v7+ is not supported )

## Running Tests
[See Here](https://github.com/dainyl/fabric-client-wrapper/blob/master/TESTS.md)

## Fabric Client Wrapper Documentation
[See here](https://github.com/dainyl/fabric-client-wrapper/blob/master/DOCUMENTATION.md)

## Examples

### Example project
Not opensourced yet, but coming soon

### Load a user from a public/private key pair
```JavaScript
import fs from "fs"
import path from "path"
import fcw from "fabric-client-wrapper"

async function foo() {
    const mspId = "Org1MSP"
    const keystorePath = path.join(__dirname, "keystore")
    const { cryptoSuite, store } = await fcw.createFileKeyValueStoreAndCryptoSuite(
        keystorePath
    )
    const privateKeyPath = path.join(__dirname, "./123_sk")
    const publicKeyPath = path.join(__dirname, "./123.pem")
    const privateKeyPEM = fs.readFileSync(privateKeyPath).toString()
    const signedCertPEM = fs.readFileSync(publicKeyPath).toString()
    const gregClient = await createUserClientFromKeys(
        {
            username,
            cryptoContent: {
                privateKeyPEM,
                signedCertPEM
            },
            store,
            cryptoSuite
        }
    )
}

foo()
```

### Load a user from the CA
```JavaScript
import fs from "fs"
import path from "path"
import fabricCAClient from "fabric-ca-client"
import fcw from "fabric-client-wrapper"

async function foo() {
    const mspId = "Org1MSP"
    const keystorePath = path.join(__dirname, "keystore")
    const { cryptoSuite, store } = await fcw.createFileKeyValueStoreAndCryptoSuite(
        keystorePath
    )
    const fabricCAClient = new FabricCAClient(
        "https://localhost:7054",
        null,
        "",
        cryptoSuite
    )
    const bobClient = await fcw.createUserClientFromCAEnroll({
        fabricCAClient,
        enrollmentID: "bob",
        enrollmentSecret: "password123"
    })
}

foo()
```

### Create a new channel object
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from 'fabric-client-wrapper'
import Orderer from 'fabric-client/lib/Orderer'

async function foo() {
    const gregClient = ...
    const peerPem = fs.readFileSync(path.join(__dirname, "./peer1.pem")).toString()
    const connectionOpts = { pem: peerPem }
    const peers = [
      gregClient.createEventHubPeer({
          requestUrl: "grpcs://peer0.org1.example.com:7051",
          eventUrl: "grpcs://peer0.org1.example.com:7053",
          peerOpts: connectionOpts,
          eventHubOpts: connectionOpts
      })
    ]
    await Promise.all(peers.map(peer => peer.waitEventHubConnected()))

    const orderer = new Orderer(
        "grpcs://orderer.example.com:7050",
        {
            pem: fs.readFileSync(path.join(__dirname, "./orderer.pem")).toString()
        }
    )

    const channel = new fcw.FcwChannel({
        client: gregClient,
        channelName: "mychannel",
        peers,
        orderer
    })
    await channel.initialize()
}

foo()
```

### Setup a channel+chaincode on the network
```JavaScript
import fs from 'fs'
import path from 'path'
import fcw from 'fabric-client-wrapper'

async function foo() {
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
          chaincodeId,
          chaincodeVersion,
          fcn: 'init',
          args: ["a", "100", "b", "200"],
      })
      .run()
}

foo()
```

### Perform an invoke+query
```JavaScript
import fcw from 'fabric-client-wrapper'

async function foo() {
    const gregClient = ...
    const channel = ...
    const transactor = fcw(gregClient, channel, 'awesomecc')
    const invokeResponse = await transactor.invoke('move', ['a', 'b', '10'])
    console.log("Invoke payload", invokeResponse.data.proposalResponse.payload.toString())
    await invokeResponse.wait() // wait for peers to write transaction to state
    const queryResponse = await transactor.query('query', ['a'])
    console.log("Query payload", queryResponse.data.payload.toString())
}

foo()
```
