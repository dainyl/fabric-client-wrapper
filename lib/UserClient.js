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

import _ from 'lodash/fp'
import type FabricClient from 'fabric-client'
import type Channel from 'fabric-client/lib/Channel'
import type Peer from 'fabric-client/lib/Peer'
import type TransactionID from 'fabric-client/lib/TransactionID'
import type FabricCAClient from 'fabric-ca-client'
import type {
    ChannelEnvelope,
    ChannelConfig,
    TransactionRequest,
    ConnectionOpts,
    ChaincodeInstallRequest,
} from './FABRIC_FLOW_TYPES'
import wait from './wait'
import { MEMBER_ROLE, type OrganizationConfig, type FcwChaincodeInstantiateUpgradeRequest } from './shared'
import pickPeersForPolicy from './pickPeersForPolicy'
import { EventHubPeer } from './fabric-client-extended'

export type CreateChannelOpts = {
    channelEnvelope?: ChannelEnvelope,
    channelConfig?: ChannelConfig,
    signatures?: Array<Object>,
    timeout: number,
}

export type TransactionProposalOpts = {
    fcn?: string,
    args?: Array<string>,
    transientMap?: Object,
}

export type CARegisterOpts = {
    role?: string,
    maxEnrollments?: number,
    attrs?: Array<Object>,
}

export type JoinChannelOpts = {
    targets?: Array<EventHubPeer>,
    genesisBlock?: Object,
    timeout: number,
}

function formatProposalResponse(response: Object) {
    response.payload = response.payload.toString()
    return response
}

function checkProposalResponses(proposalResponses: Array<Object>) {
    if (
        !proposalResponses.every(
            proposalResponse => proposalResponse.response && proposalResponse.response.status === 200
        )
    ) {
        throw proposalResponses.find(
            proposalResponse => !proposalResponse.response || proposalResponse.response.status !== 200
        )
    }
}

function createBlockEventPromise(channel: Channel, peers: Array<Peer>, timeout: number) {
    const blockEventKillSignals = []
    return [
        Promise.race(
            peers
                .filter(peer => peer.getEventHubManager)
                .map(peer => peer.getEventHubManager())
                .map(
                    eventHubManager =>
                        new Promise((resolve, reject) => {
                            let blockRegistrationNumber
                            const handle = setTimeout(() => {
                                eventHubManager.unregisterBlockEvent(blockRegistrationNumber)
                                reject()
                            }, timeout)
                            blockRegistrationNumber = eventHubManager.registerBlockEvent(
                                block => {
                                    clearTimeout(handle)
                                    eventHubManager.unregisterBlockEvent(blockRegistrationNumber)
                                    // Config block must only contain one transaction
                                    if (block.data.data.length === 1) {
                                        const channelHeader = block.data.data[0].payload.header.channel_header
                                        // we must check that this block came from the channel we asked the peer to join
                                        if (channelHeader.channel_id === channel.getName()) {
                                            resolve()
                                        } else {
                                            reject()
                                        }
                                    }
                                },
                                error => {
                                    throw error
                                }
                            )
                            blockEventKillSignals.push(() => {
                                clearTimeout(handle)
                                eventHubManager.unregisterBlockEvent(blockRegistrationNumber)
                                resolve()
                            })
                        })
                )
        ),
        blockEventKillSignals,
    ]
}

/** Class representing a user and also a wrapper over FabricClient
* @param client - The FabricClient object to wrap
* @param organizationConfig - The config of the organization the user is associated with
* @param [roles] - The set of roles for the user
*/
export default class UserClient {
    client: FabricClient
    role: string
    enrollmentSecret: ?string
    organizationConfig: OrganizationConfig
    fabricCAClient: ?FabricCAClient

    constructor(client: FabricClient, organizationConfig: OrganizationConfig, roles: Array<string> = [MEMBER_ROLE]) {
        this.client = client
        this.organizationConfig = organizationConfig
        // do not override existing roles as they come from persisted user state
        if (!this.getRoles()) {
            this.setRoles(roles)
        }
    }

    /**
    * Gets the underlying FabricClient instance
    */
    getClient(): FabricClient {
        return this.client
    }

    /**
    * Gets the organization config for the user
    */
    getOrganizationConfig(): OrganizationConfig {
        return this.organizationConfig
    }

    /**
    * Gets the username of the user
    */
    getUsername(): string {
        return this.client.getUserContext().getName()
    }

    /**
    * Gets the roles of the user
    */
    getRoles(): Array<string> {
        return this.client.getUserContext().getRoles()
    }

    /**
    * Sets the roles of the user, also saves user to store
    * @param roles The roles for the user
    */
    setRoles(roles: Array<string>) {
        this.client.getUserContext().setRoles(roles)
        this.client.saveUserToStateStore()
    }

    /**
    * Gets the FabricCAClient for the user
    */
    getFabricCAClient(): FabricCAClient {
        if (this.fabricCAClient) {
            return this.fabricCAClient
        }
        throw new Error('No FabricCAClient set')
    }

    /**
    * Sets the FabricCAClient for the user
    * @param fabricCAClient - The FabricCAClient for the CA the user is associated with
    */
    setFabricCAClient(fabricCAClient: FabricCAClient) {
        this.fabricCAClient = fabricCAClient
    }

    /**
    * gets the FabricCAClient for the user
    */
    getEnrollmentSecret(): ?string {
        return this.enrollmentSecret
    }

    /**
    * Sets the Enrollment secret for the user
    * @param enrollmentSecret - The FabricCAClient for the CA the user is associated with
    */
    setEnrollmentSecret(enrollmentSecret: string) {
        this.enrollmentSecret = enrollmentSecret
    }

    /**
    * Creates an EventHubPeer object
    * @param requestUrl the peer url to make requests to
    * @param eventUrl the peer url to listen to for events
    * @param {ReducedConnectionOpts} connectionOpts - The options for connecting to the peers request url
    * @param {number} [connectionOpts.request-timeout] - An integer value in milliseconds to be used as maximum amount of time to wait on the request to respond.
    * @param {string} connectionOpts.pem - The certificate file, in PEM format, to use with the gRPC protocol (that is, with TransportCredentials). Required when using the grpcs protocol.
    * @param {string} connectionOpts.ssl-target-name-override - Used in test environment only, when the server certificate's hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs at, the application can work around the client TLS verify failure by setting this property to the value of the server certificate's hostname
    * @param {any} connectionOpts.<any> - ANY OTHER PROPERTY. Any other standard grpc call options will be passed to the grpc service calls directly
    * @returns a new EventHubPeer instance
    */
    createEventHubPeer(opts: {
        requestUrl: string,
        eventUrl: string,
        connectionOpts: ConnectionOpts,
        role: string | void,
    }): EventHubPeer {
        return new EventHubPeer({
            ...opts,
            client: this.client,
            organizationConfig: this.organizationConfig,
        })
    }

    /**
    * Creates a channel instance bound to the user
    * @param channel - the channel object to use
    * @returns The new bound channel instance
    */
    bindChannel(channel: Channel): Channel {
        const channelClone = _.clone(channel) // TODO remove hack once client context is not tied to channel
        channelClone._clientContext = this.client // eslint-disable-line
        return channelClone
    }

    /**
    * Calls the orderer to start building the new channel. A channel typically has more than one participating organizations. To create a new channel, one of the participating organizations should call this method to submit the creation request to the orderer service. Once the channel is successfully created by the orderer, the next step is to have each organization's peer nodes join the channel, by sending the channel configuration to each of the peer nodes. The step is accomplished by calling the joinChannel() method.
    * @param channel - The channel object to users
    * @param createChannelOpts - The options for building a new channel on the network
    * @param {Array<byte>} [createChannelOpts.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [createChannelOpts.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [createChannelOpts.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param {number} [createChannelOpts.timeout=60000] - The maximum number of ms to wait for the channel to be created
    * @returns {Promise<GenesisBlock>} The genesis block for the channel
    */
    async createChannel(
        channel: Channel,
        { channelEnvelope, channelConfig, signatures, timeout = 60000 }: CreateChannelOpts
    ) {
        const userChannel = this.bindChannel(channel)
        const channelName = userChannel.getName()
        const request = {
            envelope: channelEnvelope,
            config: channelConfig,
            signatures,
            name: channelName,
            orderer: userChannel.getOrderers()[0],
            txId: this.client.newTransactionID(),
        }

        const { status } = await this.client.createChannel(request)
        if (status !== 'SUCCESS') {
            throw new Error(status)
        }
        let endDate = new Date()
        endDate = new Date(endDate.getTime() + timeout)
        while (new Date() < endDate) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const genesisBlock = await userChannel.getGenesisBlock({
                    txId: this.client.newTransactionID(),
                })
                return genesisBlock
            } catch (error) {
                if (!error.message || !error.message.includes('NOT_FOUND')) {
                    throw error
                }
                await wait(1000) // eslint-disable-line no-await-in-loop
            }
        }
        throw new Error('Channel Creation Timed Out')
    }

    /**
    * Calls the orderer to update an existing channel. After the channel updates are successfully processed by the orderer, the orderer cuts a new block containing the new channel configuration and delivers it to all the participating peers in the channel.
    * @param channel - The channel object to users
    * @param updateChannelOpts - The options for updating a channel on the network
    * @param {Array<byte>} [updateChannelOpts.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [updateChannelOpts.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [updateChannelOpts.signatures] - The signatures required for the new chanel, required if no envelope is specified
    * @param {number} [updateChannelOpts.timeout=60000] - The maximum number of ms to wait for the channel to be created
    * @returns {Promise<GenesisBlock>} The genesis block for the channel
    */
    async updateChannel(
        channel: Channel,
        { channelEnvelope, channelConfig, signatures, timeout = 60000 }: CreateChannelOpts
    ) {
        const userChannel = this.bindChannel(channel)
        const channelName = userChannel.getName()
        const request = {
            envelope: channelEnvelope,
            config: channelConfig,
            signatures,
            name: channelName,
            orderer: userChannel.getOrderers()[0],
            txId: this.client.newTransactionID(),
        }
        await channel
            .getPeers()
            .filter(peer => peer.getEventHubManager)
            .map(peer => peer.getEventHubManager().waitEventHubConnected())
        const [{ status }] = await Promise.all([
            this.client.updateChannel(request),
            createBlockEventPromise(userChannel, channel.getPeers(), timeout),
        ])
        if (status !== 'SUCCESS') {
            throw new Error(status)
        }
    }

    /**
    * This method sends a join channel proposal to one or more endorsing peers.
    * @param channel - The channel object to use
    * @param [joinChannelOpts] - The options for joining the channel
    * @param {Array<Peer>} [joinChannelOpts.targets] - An array of Peer objects or Peer names that will be asked to join this channel.
    * @param {GenesisBlock} [joinChannelOpts.genesisBlock] - The genesis block for the channel
    * @param {number} [joinChannelOpts.timeout=60000] - The maximum number of ms to wait for a peers to join
    * @returns {Promise<Array<ProposalResponseObject>>} a promise containing an array of proposal response objects
    */
    async joinChannel(channel: Channel, { targets, genesisBlock, timeout = 60000 }: JoinChannelOpts = {}) {
        const userChannel = this.bindChannel(channel)
        const channelGenesisBlock =
            genesisBlock ||
            (await userChannel.getGenesisBlock({
                txId: this.client.newTransactionID(),
            }))
        const peers =
            targets ||
            userChannel.getPeers().filter(peer => peer.getAdminMspIds().includes(this.organizationConfig.mspId))
        const request = {
            targets: peers,
            txId: this.client.newTransactionID(),
            block: channelGenesisBlock,
        }
        if (peers.length === 0) {
            return []
        }

        const [blockEventPromise, blockEventKillSignals] = createBlockEventPromise(userChannel, peers, timeout)

        await peers
            .filter(peer => peer.getEventHubManager)
            .map(peer => peer.getEventHubManager().waitEventHubConnected())

        const peerProposalResponses = await userChannel.joinChannel(request)
        try {
            checkProposalResponses(peerProposalResponses)
        } catch (error) {
            blockEventKillSignals.forEach(kill => kill())
            throw error
        }
        await blockEventPromise
        return peerProposalResponses
    }

    /**
    * Gets the genesis block for the channel
    * @param channel - The channel object to use
    */
    getChannelGenesisBlock(channel: Channel) {
        return this.bindChannel(channel).getGenesisBlock()
    }

    /**
    * Initializes a channel
    * @param channel - The channel object to use
    */
    initializeChannel(channel: Channel) {
        return this.bindChannel(channel).initialize()
    }

    /**
    * In fabric v1.0, a chaincode must be installed and instantiated before it can be called to process transactions. Chaincode installation is simply uploading the chaincode source and dependencies to the peers. This operation is "channel-agnostic" and is performed on a peer-by-peer basis. Only the peer organization's ADMIN identities are allowed to perform this operation.
    * @param {ChaincodeInstallRequest} chaincodeInstallRequest - The chaincode install request to be made
    * @param {Array<Peer>} chaincodeInstallRequest.targets - An array of Peer objects that the chaincode will be installed on
    * @param {string} chaincodeInstallRequest.chaincodePath - The path to the location of the source code of the chaincode. If the chaincode type is golang, then this path is the fully qualified package name, such as 'mycompany.com/myproject/mypackage/mychaincode'
    * @param {string} chaincodeInstallRequest.chaincodeId - Name of the chaincode
    * @param {string} chaincodeInstallRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
    * @param {string} [chaincodeInstallRequest.chaincodePackage] - Byte array of the archive content for the chaincode source. The archive must have a 'src' folder containing subfolders corresponding to the 'chaincodePath' field. For instance, if the chaincodePath is 'mycompany.com/myproject/mypackage/mychaincode', then the archive must contain a folder 'src/mycompany.com/myproject/mypackage/mychaincode', where the GO source code resides.
    * @param {string} [chaincodeInstallRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
    * @param {number} [timeout] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
    * @returns {Promise<ProposalResponseObject>} a promise containing a proposal response object
    */
    async installChaincode(chaincodeInstallRequest: ChaincodeInstallRequest, timeout?: number) {
        const result = await this.client.installChaincode(chaincodeInstallRequest, timeout)
        checkProposalResponses(result[0])
        return result
    }

    /**
    * Sends a chaincode instantiate or upgrade proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
    * @ignore
    */
    async instantiateUpgradeChaincode(
        channel: Channel,
        chaincodeInstantiateUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        waitTransactionPeers?: Array<Peer>,
        waitTransactionPeersTimeout: number = 60000,
        upgrade: boolean = false
    ) {
        const userChannel = this.bindChannel(channel)

        if (!chaincodeInstantiateUpgradeRequest.targets && chaincodeInstantiateUpgradeRequest.targetsPolicy) {
            const targetsPolicy = chaincodeInstantiateUpgradeRequest.targetsPolicy
            chaincodeInstantiateUpgradeRequest.targets = pickPeersForPolicy(userChannel.getPeers(), targetsPolicy)
        }
        const txId = this.client.newTransactionID()
        const instantiateId = txId.getTransactionID()
        const fullInstantiateUpgradeRequest = {
            ...chaincodeInstantiateUpgradeRequest,
            txId,
        }
        const fullWaitTransactionPeers = waitTransactionPeers || channel.getPeers()

        const waitInternalPeers = fullWaitTransactionPeers.filter(peer => peer.getEventHubManager)

        const waitInternalPromise = Promise.all(
            waitInternalPeers.map(peer => peer.getEventHubManager()).map(
                eventHubManager =>
                    new Promise((resolve, reject) => {
                        const handle = setTimeout(() => {
                            eventHubManager.unregisterTxEvent(instantiateId)
                            reject()
                        }, waitTransactionPeersTimeout)

                        eventHubManager.registerTxEvent(instantiateId, (tx, code) => {
                            clearTimeout(handle)
                            eventHubManager.unregisterTxEvent(instantiateId)
                            if (code !== 'VALID') {
                                reject()
                            } else {
                                resolve()
                            }
                        })
                    })
            )
        )

        await waitInternalPeers.map(peer => peer.getEventHubManager().waitEventHubConnected())

        const [proposalResponses, proposal] = await (upgrade
            ? userChannel.sendUpgradeProposal(fullInstantiateUpgradeRequest)
            : userChannel.sendInstantiateProposal(fullInstantiateUpgradeRequest))

        checkProposalResponses(proposalResponses)

        const waitExternalPeers = fullWaitTransactionPeers.filter(
            peer => typeof peer.getEventHubManager === 'undefined'
        )
        let endDate = new Date()
        endDate = new Date(endDate.getTime() + waitTransactionPeersTimeout)
        const waitExternalPromise = Promise.all(
            waitExternalPeers.map(async peer => {
                while (new Date() < endDate) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        await this.sendTransactionProposal(
                            userChannel,
                            fullInstantiateUpgradeRequest.chaincodeId,
                            [peer],
                            {
                                args: ['_'], // TODO explore why zero args seems to hang
                            }
                        )
                    } catch (error) {
                        if (!error.message || !error.message.includes('could not find chaincode with name')) {
                            return true
                        }
                        await wait(1000) // eslint-disable-line no-await-in-loop
                    }
                }
                throw new Error('External Org Peers did not instantiate chaincode in time')
            })
        )

        const waitPromise = Promise.all([waitInternalPromise, waitExternalPromise])

        const transactionRequest = {
            proposalResponses,
            proposal,
        }
        const sendPromise = channel.sendTransaction(transactionRequest)
        return Promise.all([sendPromise, waitPromise]).then(([sendPromiseResult]) => sendPromiseResult)
    }

    /**
    * Sends a chaincode instantiate proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
    * @param channel - The channel to use
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
    * @param waitTransactionPeers - The peers to wait on until the chaincode is instantiated
    * @param [waitTransactionPeersTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
    * @returns {Promise<ProposalResponseObject>} a promise containing a proposal response object
    */
    instantiateChaincode(
        channel: Channel,
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        waitTransactionPeers?: Array<Peer>,
        waitTransactionPeersTimeout: number = 60000
    ) {
        return this.instantiateUpgradeChaincode(
            channel,
            chaincodeInstantiateRequest,
            waitTransactionPeers,
            waitTransactionPeersTimeout
        )
    }

    /**
    * Sends a chaincode upgrade proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
    * @param channel - The channel to use
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
    * @param waitTransactionPeers - The peers to wait on until the chaincode is instantiated
    * @param [waitTransactionPeersTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
    * @returns {Promise<ProposalResponseObject>} a promise containing a proposal response object
    */
    upgradeChaincode(
        channel: Channel,
        chaincodeUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        waitTransactionPeers?: Array<Peer>,
        waitTransactionPeersTimeout: number = 60000
    ) {
        return this.instantiateUpgradeChaincode(
            channel,
            chaincodeUpgradeRequest,
            waitTransactionPeers,
            waitTransactionPeersTimeout,
            true
        )
    }

    /**
        * Sends a Transaction Proposal to peers in a channel
        * @param channel - The channel object to use
        * @param chaincodeId - The id of the channel
        * @param [targets] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
        * @param [opts] - The options for the transaction proposal
        * @param {string} [opts.fcn] - The function to be called on the chaincode, defaults to 'invoke'
        * @param {Array<string>} [opts.args] - The arguments to suppied to the chaincode function
        * @param {string} [opts.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
        * @returns A promise containing the transaction ID and transaction request objects
        */
    async sendTransactionProposal(
        channel: Channel,
        chaincodeId: string,
        targets?: Array<Peer>,
        opts?: TransactionProposalOpts = {}
    ): Promise<{
        txId: TransactionID,
        transactionRequest: TransactionRequest,
    }> {
        const userChannel = this.bindChannel(channel)
        const txId = this.client.newTransactionID()

        const request = {
            chaincodeId,
            targets,
            txId,
            args: [],
            ...opts,
        }

        // send query
        const [proposalResponses, proposal] = await userChannel.sendTransactionProposal(request)
        checkProposalResponses(proposalResponses)

        return {
            txId,
            transactionRequest: {
                proposalResponses,
                proposal,
            },
        }
    }

    /**
        * Sends a Transaction to peers in a channel
        * @param channel - The channel object to use
        * @param transactionId - The transaction ID to wait on
        * @param transactionRequest - An object containing the proposal responses from the peers and the proposal
        * @param [timeout=60000] - The maximum amount of time to wait for the transaction
        * @returns A promise containing the response to the transaction
        */
    async sendTransaction(
        channel: Channel,
        transactionId: string,
        transactionRequest: TransactionRequest,
        timeout: number = 60000
    ): Promise<{
        status: string,
    }> {
        const userChannel = this.bindChannel(channel)

        const txPromise = Promise.race(
            channel
                .getPeers()
                .filter(peer => peer.getEventHubManager)
                .map(peer => peer.getEventHubManager())
                .map(
                    eventHubManager =>
                        new Promise((resolve, reject) => {
                            const handle = setTimeout(() => {
                                eventHubManager.unregisterTxEvent(transactionId)
                                reject()
                            }, timeout)

                            eventHubManager.registerTxEvent(
                                transactionId,
                                (tx, code) => {
                                    clearTimeout(handle)
                                    eventHubManager.unregisterTxEvent(transactionId)
                                    if (code !== 'VALID') {
                                        reject(code)
                                    } else {
                                        resolve()
                                    }
                                },
                                () => {
                                    clearTimeout(handle)
                                    eventHubManager.unregisterTxEvent(transactionId)
                                }
                            )
                        })
                )
        )

        await channel
            .getPeers()
            .filter(peer => peer.getEventHubManager)
            .map(peer => peer.getEventHubManager().waitEventHubConnected())

        // set the transaction listener and set a timeout
        // if the transaction did not get committed within the timeout period fail
        const sendPromise = userChannel.sendTransaction(transactionRequest)
        return Promise.all([sendPromise, txPromise]).then(([sendResult]) => sendResult)
    }

    /**
        * Sends a Transaction Proposal to peers in a channel and formats the response
        * @param channel - The channel object to use
        * @param chaincodeId - The id of the channel
        * @param [targets] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
        * @param [opts] - The options for the transaction proposal
        * @param {string} [opts.fcn] - The function to be called on the chaincode, defaults to 'invoke'
        * @param {Array<string>} [opts.args] - The arguments to suppied to the chaincode function
        * @param {string} [opts.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
        * @returns A formatted proposal response from a single peer
        */
    queryChaincode(
        channel: Channel,
        chaincodeId: string,
        targets: Array<Peer>,
        opts?: TransactionProposalOpts
    ): Promise<{ status: number, message: string, payload: string }> {
        return this.sendTransactionProposal(channel, chaincodeId, targets, opts).then(({ transactionRequest }) =>
            formatProposalResponse(transactionRequest.proposalResponses[0].response)
        )
    }

    /**
        * Sends a Transaction Proposal to peers in a channel and formats the response
        * @param channel - The channel object to use
        * @param chaincodeId - The id of the channel
        * @param [targets] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
        * @param [opts] - The options for the transaction proposal
        * @param {string} [opts.fcn] - The function to be called on the chaincode, defaults to 'invoke'
        * @param {Array<string>} [opts.args] - The arguments to suppied to the chaincode function
        * @param {string} [opts.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
        * @param [sendTransactionTimeout] - The maximum amount of time to wait for the transaction
        * @returns An object holding the transaction response, transaction proposal response, and transaction ID
        */
    async invokeChaincode(
        channel: Channel,
        chaincodeId: string,
        targets: Array<Peer>,
        opts?: TransactionProposalOpts,
        sendTransactionTimeout?: number
    ): Promise<{
        transactionResponse: { status: string },
        proposalResponse: { status: number, message: string, payload: string },
        transactionId: string,
    }> {
        const { txId, transactionRequest } = await this.sendTransactionProposal(channel, chaincodeId, targets, opts)
        const transactionResponse = await this.sendTransaction(
            channel,
            txId.getTransactionID(),
            transactionRequest,
            sendTransactionTimeout
        )
        return {
            transactionResponse,
            proposalResponse: formatProposalResponse(transactionRequest.proposalResponses[0].response),
            transactionId: txId.getTransactionID(),
        }
    }

    /**
    * This method registers a new user in the CA, requires an admin of the CA
    * @param username - The username of the new user
    * @param affiliation - The affiliation of the new user
    * @param [opts] - Options for registering the user
    * @param {string} [opts.role] - The role of the new user
    * @param {number} [opts.maxEnrollments] - The maximum number of times a user can enroll
    * @param {Array<KeyValueAttribute>} [opts.attrs] -  Array of key/value attributes to assign to the user.
    * @returns The enrollment secret to use when this user enrolls
    */
    async registerUserInCA(username: string, affiliation: string, opts: CARegisterOpts = {}): Promise<string> {
        const caAdminUser = this.client.getUserContext()
        const fabricCAClient = this.getFabricCAClient()
        return fabricCAClient.register(
            {
                ...opts,
                enrollmentID: username,
                affiliation,
            },
            caAdminUser
        )
    }

    /**
    * Extracts the protobuf 'ConfigUpdate' object out of the 'ConfigEnvelope' object that is produced by the configtxgen tool. The returned object may then be signed using the signChannelConfig() method of this class. Once the all signatures have been collected, the 'ConfigUpdate' object and the signatures may be used on the createChannel() or updateChannel() calls.
    * @param {Array<byte>} channelEnvelope - The encoded bytes of the ConfigEnvelope protobuf
    * @returns {Array<byte>} Channel Config object
    */
    extractChannelConfig(channelEnvelope: ChannelEnvelope) {
        return this.client.extractChannelConfig(channelEnvelope)
    }

    /**
    * Channel configuration updates can be sent to the orderers to be processed. The orderer enforces the Channel creation or update policies such that the updates will be made only when enough signatures from participating organizations are discovered in the request. Typically channel creation or update requests must be signed by participating organizations' ADMIN principals, although this policy can be customized when the consortium is defined. This method uses the client instance's current signing identity to sign over the configuration bytes passed in, and returns the signature that is ready to be included in the configuration update protobuf message to send to the orderer.
    * @param {Array<byte>} channelConfig The channel configuration to sign
    * @returns {ConfigSignature} The signature of the user on the config bytes
    */
    signChannelConfig(channelConfig: ChannelConfig) {
        return this.client.signChannelConfig(channelConfig)
    }
}
