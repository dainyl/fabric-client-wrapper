// @flow
// /**
//  * Copyright 2017 IBM All Rights Reserved.
//  *
//  * Licensed under the Apache License, Version 2.0 (the 'License');
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *    http://www.apache.org/licenses/LICENSE-2.0
//  *
//  *  Unless required by applicable law or agreed to in writing, software
//  *  distributed under the License is distributed on an 'AS IS' BASIS,
//  *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  *  See the License for the specific language governing permissions and
//  *  limitations under the License.
//  */

import type Peer from 'fabric-client/lib/Peer'
import type Channel from 'fabric-client/lib/Channel'
import type Orderer from 'fabric-client/lib/Orderer'
import type UserClient, { CreateChannelOpts, JoinChannelOpts } from './UserClient'
import { FcwChannel, type FcwPeer } from './fabric-client-extended'
import type { FcwChaincodeInstantiateUpgradeRequest } from './shared'

export type ReducedChaincodeInstallRequest = {
    targets: Array<Peer> | void,
    chaincodeId: string,
    chaincodePath: string,
    chaincodeVersion: string,
    chaincodePackage?: Object,
    chaincodeType?: string,
}

/** Class for building and running channel setup requests
* @param userClient - The UserClient representing the user setting up the channel
* @param channelOrChannelName - Either the channel object you wish to use or the name of the channel
* @param [peers] - The peers you wish to use for the channel, only required when supplying the name of the channel
* @param [orderer] - The orderer you wish to use for the channel, only required when supplying the name of the channel
*/
export default class ChannelSetup {
    userClient: UserClient
    channel: Channel
    newChannelOp: ?() => Channel
    joinChannelOp: ?Function
    createChannelOp: ?Function
    updateChannelOp: ?Function
    installChaincodeOps: Array<Function>
    instantiateChaincodeOps: Array<Function>
    upgradeChaincodeOps: Array<Function>

    constructor(
        userClient: UserClient,
        channelOrChannelName: Channel | string,
        peers: Array<FcwPeer>,
        orderer: Orderer
    ) {
        this.userClient = userClient
        this.installChaincodeOps = []
        this.instantiateChaincodeOps = []
        this.upgradeChaincodeOps = []
        if (typeof channelOrChannelName !== 'string') {
            this.channel = channelOrChannelName
        } else {
            this.newChannelOp = () =>
                new FcwChannel({
                    channelName: (channelOrChannelName: any),
                    peers,
                    orderer,
                })
        }
    }

    /**
    * Adds a createChannel operation to the builder
    * @param createChannelOpts - The options for creating a channel on the network
    * @param {Array<byte>} [createChannelOpts.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [createChannelOpts.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [createChannelOpts.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param {number} [createChannelOpts.timeout=60000] - The maximum number of ms to wait for the channel to be created
    * @returns The ChannelSetup instance
    */
    withCreateChannel(createChannelOpts: CreateChannelOpts): ChannelSetup {
        if (this.createChannelOp) {
            throw new Error('Cannot call createChannel more than once in a single setup')
        }
        this.createChannelOp = (channel: Channel) =>
            this.userClient.createChannel(channel, createChannelOpts).then(response => response.wait())
        return this
    }

    /**
    * Adds a joinChannel operation to the builder
    * @param [joinChannelOpts] - The options for joining the channel on the network
    * @param {Array<Peer|FcwPeer|EventHubPeer>} [joinChannelOpts.targets] - An array of Peer objects or Peer names that will be asked to join this channel.
    * @param {GenesisBlock} [joinChannelOpts.genesisBlock] - The genesis block for the channel
    * @param {number} [joinChannelOpts.timeout=60000] - The maximum number of ms to wait for a peers to join
    * @returns The ChannelSetup instance
    */
    withJoinChannel(joinChannelOpts?: JoinChannelOpts): ChannelSetup {
        if (this.joinChannelOp) {
            throw new Error('Cannot call joinChannel more than once in a single setup')
        }
        this.joinChannelOp = (channel: Channel, genesisBlock?: Object) =>
            this.userClient
                .joinChannel(channel, {
                    ...joinChannelOpts,
                    genesisBlock,
                })
                .then(response => response.wait())
        return this
    }

    /**
    * Adds an updateChannel operation to the builder
    * @param updateChannelOpts - The options for updating a channel on the network
    * @param {Array<byte>} [updateChannelOpts.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [updateChannelOpts.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [updateChannelOpts.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param {number} [updateChannelOpts.timeout=60000] - The maximum number of ms to wait for the channel to be created
    * @returns The ChannelSetup instance
    */
    withUpdateChannel(updateChannelOpts: CreateChannelOpts): ChannelSetup {
        if (this.updateChannelOp) {
            throw new Error('Cannot call updateChannel more than once in a single setup')
        }
        this.updateChannelOp = (channel: Channel) =>
            this.userClient.updateChannel(channel, updateChannelOpts).then(response => response.wait())
        return this
    }

    /**
    * Adds an installChaincode operation to the builder
    * @param chaincodeInstallRequest - The options for installing chaincode on peers.
    * @param {Array<Peer>} [chaincodeInstallRequest.targets] - An array of Peer objects that the chaincode will be installed on. Uses peers from channel if none are supplied
    * @param {string} chaincodeInstallRequest.chaincodePath - The path to the location of the source code of the chaincode. If the chaincode type is golang, then this path is the fully qualified package name, such as 'mycompany.com/myproject/mypackage/mychaincode'
    * @param {string} chaincodeInstallRequest.chaincodeId - Name of the chaincode
    * @param {string} chaincodeInstallRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
    * @param {string} [chaincodeInstallRequest.chaincodePackage] - Byte array of the archive content for the chaincode source. The archive must have a 'src' folder containing subfolders corresponding to the 'chaincodePath' field. For instance, if the chaincodePath is 'mycompany.com/myproject/mypackage/mychaincode', then the archive must contain a folder 'src/mycompany.com/myproject/mypackage/mychaincode', where the GO source code resides.
    * @param {string} [chaincodeInstallRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
    * @param [timeout] - The max amount of time the chaincode installing can take
    * @returns The ChannelSetup instance
    */
    withInstallChaincode(chaincodeInstallRequest: ReducedChaincodeInstallRequest, timeout?: number): ChannelSetup {
        this.installChaincodeOps.push(channel => {
            let targets
            if (chaincodeInstallRequest.targets) {
                targets = chaincodeInstallRequest.targets
            } else {
                targets = channel
                    .getPeers()
                    .filter(peer => peer.getAdminMspIds().includes(this.userClient.getOrganizationConfig().mspId))
            }
            return this.userClient.installChaincode(
                {
                    ...chaincodeInstallRequest,
                    targets,
                },
                timeout
            )
        })
        return this
    }

    /**
    * Adds an instantiateChaincode operation to the builder
    * @param chaincodeInstantiateRequest - The chaincode instantiation request to be made
    * @param {Array<Peer>} [chaincodeInstantiateRequest.targets] - An array of Peer objects that are used to satisfy the instantiation policy. Defaults to channel peers if not specified
    * @param {Policy} [chaincodeInstantiateRequest.targetsPolicy] - A policy used to select peers from the channel if targets is not specified
    * @param {string} chaincodeInstantiateRequest.chaincodeId - Name of the chaincode
    * @param {string} chaincodeInstantiateRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
    * @param {string} [chaincodeInstantiateRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
    * @param {Map} [chaincodeInstantiateRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
    * @param {string} [chaincodeInstantiateRequest.fcn] - The function name to be returned when calling stub.GetFunctionAndParameters() in the target chaincode. Default is 'init'
    * @param {string[]} [chaincodeInstantiateRequest.args] - Array of string arguments to pass to the function identified by the fcn value
    * @param {Policy} [chaincodeInstantiateRequest.endorsement-policy] - EndorsementPolicy object for this chaincode (see examples below). If not specified, a default policy of "a signature by any member from any of the organizations corresponding to the array of member service providers" is used. WARNING: The default policy is NOT recommended for production, because this allows an application to bypass the proposal endorsement and send a manually constructed transaction, with arbitrary output in the write set, to the orderer directly. An application's own signature would allow the transaction to be successfully validated and committed to the ledger.
    * @param {Array<Peer>} waitTransactionPeers - The peers to wait on until the chaincode is instantiated
    * @param [waitTransactionPeersTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
    * @param {Array<Peer>} [waitTransactionPeers] - The peers to poll to check if the chaincode has been instantiated
    * @param [waitTransactionTimeout=60000] - The max amount of time to wait for peers to be instantiated
    * @returns The ChannelSetup instance
    */
    withInstantiateChaincode(
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        waitTransactionPeers?: Array<Peer>,
        waitTransactionTimeout: number = 60000
    ): ChannelSetup {
        this.instantiateChaincodeOps.push(channel =>
            this.userClient
                .instantiateChaincode(
                    channel,
                    chaincodeInstantiateRequest,
                    waitTransactionPeers,
                    waitTransactionTimeout
                )
                .then(response => response.wait())
        )
        return this
    }

    /**
    * Adds an upgradeChaincode operation to the builder
    * @param chaincodeUpgradeRequest - The chaincode upgrade request to be made
    * @param {Array<Peer>} [chaincodeUpgradeRequest.targets] - An array of Peer objects that are used to satisfy the instantiation policy. Defaults to channel peers if not specified
    * @param {Policy} [chaincodeUpgradeRequest.targetsPolicy] - A policy used to select peers from the channel if targets is not specified
    * @param {string} chaincodeUpgradeRequest.chaincodeId - Name of the chaincode
    * @param {string} chaincodeUpgradeRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
    * @param {string} [chaincodeUpgradeRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
    * @param {Map} [chaincodeUpgradeRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
    * @param {string} [chaincodeUpgradeRequest.fcn] - The function name to be returned when calling stub.GetFunctionAndParameters() in the target chaincode. Default is 'init'
    * @param {string[]} [chaincodeUpgradeRequest.args] - Array of string arguments to pass to the function identified by the fcn value
    * @param {Policy} [chaincodeUpgradeRequest.endorsement-policy] - EndorsementPolicy object for this chaincode (see examples below). If not specified, a default policy of "a signature by any member from any of the organizations corresponding to the array of member service providers" is used. WARNING: The default policy is NOT recommended for production, because this allows an application to bypass the proposal endorsement and send a manually constructed transaction, with arbitrary output in the write set, to the orderer directly. An application's own signature would allow the transaction to be successfully validated and committed to the ledger.
    * @param {Array<Peer>} waitTransactionPeers - The peers to wait on until the chaincode is instantiated
    * @param [waitTransactionPeersTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
    * @returns The ChannelSetup instance
    */
    withUpgradeChaincode(
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        waitTransactionPeers?: Array<Peer>,
        waitTransactionTimeout: number = 60000
    ): ChannelSetup {
        this.upgradeChaincodeOps.push(channel =>
            this.userClient
                .upgradeChaincode(channel, chaincodeInstantiateRequest, waitTransactionPeers, waitTransactionTimeout)
                .then(response => response.wait())
        )
        return this
    }

    /**
    * Sends the request that has been built
    * @returns The channel instance that has been setup
    */
    async run(): Promise<Channel> {
        if (this.channel && this.newChannelOp) {
            throw new Error('Cannot call useChannel and newChannel. Only a single channel can be used')
        }

        if (!this.channel && !this.newChannelOp) {
            throw new Error(
                'setup cannot be used without a channel. If you wish to only install chaincode use UserClient.installChaincode'
            )
        }

        if (this.newChannelOp) {
            this.channel = this.newChannelOp()
        }
        if (!this.channel) {
            throw new Error('Unexpected error, no channel found')
        }
        const channel = this.userClient.bindChannel(this.channel)

        let initChannelPromise = Promise.resolve()

        if (this.createChannelOp) {
            const createChannelOp = this.createChannelOp
            initChannelPromise = initChannelPromise
                .then(() =>
                    channel.getGenesisBlock({
                        txId: this.userClient.client.newTransactionID(),
                    })
                )
                .catch(error => {
                    if (!error.message.includes('NOT_FOUND')) {
                        throw error
                    }
                    return createChannelOp(channel)
                })
        }

        if (this.joinChannelOp) {
            const joinChannelOp = this.joinChannelOp
            initChannelPromise = initChannelPromise
                .then(genesisBlock => joinChannelOp(channel, genesisBlock))
                .catch(error => {
                    if (
                        !error.message ||
                        !error.message.includes(
                            'Cannot create ledger from genesis block, due to LedgerID already exists'
                        )
                    ) {
                        throw error
                    }
                })
        }

        if (this.updateChannelOp) {
            const updateChannelOp = this.updateChannelOp
            initChannelPromise = initChannelPromise.then(genesisBlock => updateChannelOp(channel))
        }

        if (!channel.isInitialized) {
            initChannelPromise = initChannelPromise.then(async () => {
                if (!channel.isInitialized) {
                    try {
                        await channel.initialize()
                        channel.isInitialized = true
                    } catch (error) {
                        if (!error.message.includes('NOT_FOUND')) {
                            throw error
                        }
                    }
                }
                return null
            })
        }

        const installChaincodePromise = Promise.all(
            this.installChaincodeOps.map(installChaincodeOp =>
                installChaincodeOp(channel).catch(error => {
                    if (!error.message || !error.message.match(/\(chaincode [^\b]+ exists\)/)) {
                        throw error
                    }
                })
            )
        )
        await Promise.all([initChannelPromise, installChaincodePromise])

        if (this.instantiateChaincodeOps.length !== 0 || this.upgradeChaincodeOps.length !== 0) {
            await Promise.all(
                this.instantiateChaincodeOps
                    .map(instantiateChaincodeOp =>
                        instantiateChaincodeOp(channel).catch(error => {
                            if (!error.message || !error.message.includes('chaincode exists')) {
                                throw error
                            }
                        })
                    )
                    .concat(this.upgradeChaincodeOps.map(upgradeChaincodeOp => upgradeChaincodeOp(channel)))
            )
        }
        return channel
    }
}
