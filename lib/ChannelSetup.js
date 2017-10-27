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
import type UserClient, { CreateChannelRequest, JoinChannelRequest } from './UserClient'
import type MultiUserClient from './MultiUserClient'
import { isMultiUserClient } from './MultiUserClient'
import { FcwChannel, isFcwPeer, type FcwChannelOpts } from './fabric-client-extended'
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
* @param channelOrChannelOpts - Either the channel object you wish to use or the arguments to create a new channel
* @param [swallowAlreadyCreatedErrors] - Option to swallow errors about channel being already created/joined or chaincode being installed/instantiated
*/
export default class ChannelSetup {
    userClient: UserClient | MultiUserClient
    channel: Channel
    swallowAlreadyCreatedErrors: boolean
    newChannelOp: ?() => Channel
    joinChannelOp: ?Function
    createChannelOp: ?Function
    updateChannelOp: ?Function
    installChaincodeOps: Array<Function>
    instantiateChaincodeOps: Array<Function>
    upgradeChaincodeOps: Array<Function>

    constructor(
        userClient: UserClient,
        channelOrChannelOpts: Channel | FcwChannelOpts,
        swallowAlreadyCreatedErrors: boolean = false
    ) {
        this.userClient = userClient
        this.installChaincodeOps = []
        this.instantiateChaincodeOps = []
        this.upgradeChaincodeOps = []
        if (channelOrChannelOpts.getPeers) {
            this.channel = channelOrChannelOpts
        } else {
            this.newChannelOp = () => new FcwChannel(channelOrChannelOpts)
        }
        this.swallowAlreadyCreatedErrors = swallowAlreadyCreatedErrors
    }

    isSwallowAlreadyCreatedErrors(swallowAlreadyCreatedErrors?: boolean) {
        return typeof swallowAlreadyCreatedErrors !== 'undefined'
            ? swallowAlreadyCreatedErrors
            : this.swallowAlreadyCreatedErrors
    }

    /**
    * Adds a createChannel operation to the builder
    * @param createChannelRequest - The options for creating a channel on the network
    * @param {Array<byte>} [createChannelRequest.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [createChannelRequest.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [createChannelRequest.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param [swallowAlreadyCreatedErrors] - Option to swallow errors about channel being already created. Overrides class level option
    * @returns The ChannelSetup instance
    */
    withCreateChannel(
        createChannelRequest: CreateChannelRequest,
        {
            waitOpts,
            swallowAlreadyCreatedErrors,
        }: {
            waitOpts?: Object,
            swallowAlreadyCreatedErrors?: boolean,
        } = {}
    ): ChannelSetup {
        // TODO type waitOpts
        if (this.createChannelOp) {
            throw new Error('Cannot call createChannel more than once in a single setup')
        }

        if (this.isSwallowAlreadyCreatedErrors(swallowAlreadyCreatedErrors)) {
            this.createChannelOp = (channel: Channel) =>
                channel
                    .getGenesisBlock({
                        txId: this.userClient.newTransactionID(),
                    })
                    .catch(error => {
                        if (!error.message.includes('NOT_FOUND')) {
                            throw error
                        }
                        return this.userClient
                            .createChannel(channel, createChannelRequest)
                            .then(response => response.wait())
                    })
        } else {
            this.createChannelOp = (channel: Channel) =>
                this.userClient.createChannel(channel, createChannelRequest).then(response => response.wait(waitOpts))
        }
        return this
    }

    /**
    * Adds a joinChannel operation to the builder
    * @param [joinChannelRequest] - The options for joining the channel on the network
    * @param {Array<Peer|FcwPeer|EventHubPeer>} [joinChannelRequest.targets] - An array of Peer objects or Peer names that will be asked to join this channel.
    * @param {GenesisBlock} [joinChannelRequest.genesisBlock] - The genesis block for the channel
    * @param {number} [timeout=60000] - The maximum number of ms to wait for the channel to be joined
    * @param {number} [waitTimeout=60000] - The maximum number of ms to wait for confirmation that the channel has been joined
    * @param [swallowAlreadyCreatedErrors] - Option to swallow errors about channel being already joined. Overrides class level option
    * @returns The ChannelSetup instance
    */
    withJoinChannel(
        joinChannelRequest?: JoinChannelRequest,
        {
            timeout,
            waitOpts,
            swallowAlreadyCreatedErrors,
        }: {
            timeout?: number,
            waitOpts?: Object,
            swallowAlreadyCreatedErrors?: boolean,
        } = {}
    ): ChannelSetup {
        if (this.joinChannelOp) {
            throw new Error('Cannot call joinChannel more than once in a single setup')
        }

        this.joinChannelOp = (channel: Channel, genesisBlock?: Object) =>
            (this.userClient.joinChannel(
                channel,
                joinChannelRequest
                    ? {
                          ...joinChannelRequest,
                          genesisBlock,
                      }
                    : { genesisBlock },
                timeout
            ): any)
                .then(response => response.wait(waitOpts))
                .catch(error => {
                    if (
                        !this.isSwallowAlreadyCreatedErrors(swallowAlreadyCreatedErrors) ||
                        !error.message ||
                        !error.message.includes(
                            'Cannot create ledger from genesis block, due to LedgerID already exists'
                        )
                    ) {
                        throw error
                    }
                })
        return this
    }

    /**
    * Adds an updateChannel operation to the builder
    * @param updateChannelRequest - The options for updating a channel on the network
    * @param {Array<byte>} [updateChannelRequest.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [updateChannelRequest.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [updateChannelRequest.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param {number} [waitTimeout=60000] - The maximum number of ms to wait for confirmation that the channel has been updated
    * @returns The ChannelSetup instance
    */
    withUpdateChannel(updateChannelRequest: CreateChannelRequest, { waitOpts }: { waitOpts?: Object }): ChannelSetup {
        if (this.updateChannelOp) {
            throw new Error('Cannot call updateChannel more than once in a single setup')
        }
        this.updateChannelOp = (channel: Channel) =>
            this.userClient.updateChannel(channel, updateChannelRequest).then(response => response.wait(waitOpts))
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
    * @param [swallowAlreadyCreatedErrors] - Option to swallow errors about chaincode being already installed. Overrides class level option
    * @returns The ChannelSetup instance
    */
    withInstallChaincode(
        chaincodeInstallRequest: ReducedChaincodeInstallRequest,
        {
            timeout,
            swallowAlreadyCreatedErrors,
        }: {
            timeout?: number,
            swallowAlreadyCreatedErrors?: boolean,
        }
    ): ChannelSetup {
        this.installChaincodeOps.push(channel => {
            let targets
            if (chaincodeInstallRequest.targets) {
                targets = chaincodeInstallRequest.targets
            } else if (isMultiUserClient(this.userClient)) {
                targets = channel.getPeers()
            } else {
                targets = channel
                    .getPeers()
                    .filter(
                        peer =>
                            !isFcwPeer(peer) ||
                            peer.getAdminMspIds().includes((this.userClient: any).getOrganizationConfig().mspId)
                    )
            }
            return (this.userClient.installChaincode(
                {
                    ...chaincodeInstallRequest,
                    targets,
                },
                timeout
            ): any).catch(error => {
                if (
                    !this.isSwallowAlreadyCreatedErrors(swallowAlreadyCreatedErrors) ||
                    !error.message ||
                    !error.message.match(/\(chaincode [^\b]+ exists\)/)
                ) {
                    throw error
                }
            })
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
    * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @param [swallowAlreadyCreatedErrors] - Option to swallow errors about chaincode being already instantiated. Overrides class level option
    * @returns The ChannelSetup instance
    */
    withInstantiateChaincode(
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        {
            timeout,
            waitOpts,
            swallowAlreadyCreatedErrors,
        }: {
            timeout?: number,
            waitOpts?: Object,
            swallowAlreadyCreatedErrors?: boolean,
        }
    ): ChannelSetup {
        this.instantiateChaincodeOps.push(channel =>
            this.userClient
                .instantiateChaincode(channel, chaincodeInstantiateRequest, timeout)
                .then(response => response.wait(waitOpts))
                .catch(error => {
                    if (
                        !this.isSwallowAlreadyCreatedErrors(swallowAlreadyCreatedErrors) ||
                        !error.message ||
                        !error.message.includes('chaincode exists')
                    ) {
                        throw error
                    }
                })
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
    * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @param [swallowAlreadyCreatedErrors] - Option to swallow errors about chaincode being already instantiated. Overrides class level option
    * @returns The ChannelSetup instance
    */
    withUpgradeChaincode(
        chaincodeUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        {
            timeout,
            waitOpts,
        }: {
            timeout?: number,
            waitOpts?: Object,
        }
    ): ChannelSetup {
        this.upgradeChaincodeOps.push(channel =>
            this.userClient
                .upgradeChaincode(channel, chaincodeUpgradeRequest, timeout)
                .then(response => response.wait(waitOpts))
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
            initChannelPromise = initChannelPromise.then(() => createChannelOp(channel))
        }

        if (this.joinChannelOp) {
            const joinChannelOp = this.joinChannelOp
            initChannelPromise = initChannelPromise.then(genesisBlock => joinChannelOp(channel, genesisBlock))
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
            this.installChaincodeOps.map(installChaincodeOp => installChaincodeOp(channel))
        )
        await Promise.all([initChannelPromise, installChaincodePromise])

        if (this.instantiateChaincodeOps.length !== 0 || this.upgradeChaincodeOps.length !== 0) {
            await Promise.all(
                this.instantiateChaincodeOps
                    .map(instantiateChaincodeOp => instantiateChaincodeOp(channel))
                    .concat(this.upgradeChaincodeOps.map(upgradeChaincodeOp => upgradeChaincodeOp(channel)))
            )
        }
        return channel
    }
}
