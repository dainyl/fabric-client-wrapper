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
import { remove } from 'lodash/array'
import type Channel from 'fabric-client/lib/Channel'
import type Peer from 'fabric-client/lib/Peer'
import type TransactionID from 'fabric-client/lib/TransactionID'
import type { TransactionRequest, ChaincodeInstallRequest } from './FABRIC_FLOW_TYPES'
import type { FcwChaincodeInstantiateUpgradeRequest } from './shared'
import { isFcwPeer } from './fabric-client-extended'
import type UserClient, {
    CreateChannelRequest,
    TransactionProposalRequest,
    JoinChannelRequest,
    QueryChaincodeRequest,
    TimeoutPeersOpts,
} from './UserClient'

/** Class representing multiple UserClient instances, can be used for making channel/chaincode operations
* @param userClients - The UserClient instances to use
* @param mainUserClient - The UserClient instance to use for requests that only require a single UserClient
*/
export default class MultiUserClient {
    userClients: Array<UserClient>
    mainUserClient: UserClient

    constructor(userClients: Array<UserClient>, mainUserClient?: UserClient) {
        this.userClients = userClients
        if (mainUserClient) {
            this.mainUserClient = mainUserClient
        } else {
            this.mainUserClient = userClients[0]
        }
    }

    /**
    * Returns the underlying UserClient instances
    */
    getUserClients(): Array<UserClient> {
        return this.userClients
    }

    /**
    * Returns the main UserClient instance
    */
    getMainUserClient(): UserClient {
        return this.mainUserClient
    }

    /**
    * Returns a new TransactionID object. Fabric transaction ids are constructed as a hash of a nonce concatenated with the signing identity's serialized bytes. The TransactionID object keeps the nonce and the resulting id string bundled together as a coherent pair.
    */
    newTransactionID(): TransactionID {
        return this.mainUserClient.newTransactionID()
    }

    /**
    * Queries the target peer for the names of all the channels that a peer has joined.
    */
    queryChannels(peer: Peer) {
        return this.mainUserClient.queryChannels(peer)
    }

    /**
    * Queries the installed chaincodes on a peer.
    */
    queryInstalledChaincodes(peer: Peer) {
        return this.mainUserClient.queryInstalledChaincodes(peer)
    }

    /**
    * Queries for various useful information on the state of the Channel (height, known peers).
    */
    queryChannelInfo(channel: Channel, target: Peer) {
        return this.mainUserClient.queryChannelInfo(channel, target)
    }

    /**
    * Queries the ledger on the target peer for instantiated chaincodes on this channel.
    */
    queryInstantiatedChaincodes(channel: Channel, target: Peer) {
        return this.mainUserClient.queryInstantiatedChaincodes(channel, target)
    }

    /**
    * Queries the ledger on the target peer for Transaction by id.
    */
    queryTransaction(channel: Channel, txId: string, target: Peer) {
        return this.bindChannel(channel).queryTransaction(txId, target)
    }

    /**
    * Returns whether a channel has been joined by all peers owned by the clients' organizations in the channel object
    */
    async isChaincodeInstalled(channelOrPeers: Channel | Array<Peer>, chaincodeId: string, chaincodeVersion?: string) {
        return this.userClients.every(userClient =>
            userClient.isChaincodeInstalled(channelOrPeers, chaincodeId, chaincodeVersion)
        )
    }

    /**
    * Returns whether a channel has been created
    */
    async isChannelCreated(channel: Channel): Promise<boolean> {
        return this.mainUserClient.isChannelCreated(channel)
    }

    /**
    * Returns whether a channel has been joined by all peers owned by the clients organization in the channel object
    */
    async isChannelJoined(channel: Channel): Promise<boolean> {
        return this.userClients.every(userClient => userClient.isChannelJoined(channel))
    }

    /**
    * Returns whether a chaincode has been instantiated on a channel
    */
    async isChaincodeInstantiated(channel: Channel, chaincodeId: string, chaincodeVersion?: string): Promise<boolean> {
        return this.userClients.every(userClient =>
            userClient.isChaincodeInstantiated(channel, chaincodeId, chaincodeVersion)
        )
    }

    /**
    * Creates a channel instance bound to the user
    * @param channel - the channel object to use
    * @returns The new bound channel instance
    */
    bindChannel(channel: Channel): Channel {
        return this.mainUserClient.bindChannel(channel)
    }

    /**
    * Gets the genesis block for the channel
    * @param channel - The channel object to use
    */
    getChannelGenesisBlock(channel: Channel) {
        return this.mainUserClient.getChannelGenesisBlock(channel)
    }

    /**
    * Initializes a channel
    * @param channel - The channel object to use
    */
    initializeChannel(channel: Channel) {
        return this.mainUserClient.initializeChannel(channel)
    }

    /**
    * Calls the orderer to start building the new channel. A channel typically has more than one participating organizations. To create a new channel, one of the participating organizations should call this method to submit the creation request to the orderer service. Once the channel is successfully created by the orderer, the next step is to have each organization's peer nodes join the channel, by sending the channel configuration to each of the peer nodes. The step is accomplished by calling the joinChannel() method.
    * @param channel - The channel object to users
    * @param createChannelRequest - The options for building a new channel on the network
    * @param {Array<byte>} [createChannelRequest.channelEnvelope] - The envelope for the new channel, required if no config is specified
    * @param {Array<byte>} [createChannelRequest.channelConfig] - The configuration for the new channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [createChannelRequest.signatures] - The signatures required for the new channel, required if no envelope is specified
    * @param {number} [timeout=60000] - The maximum number of ms to wait for the channel to be created
    * @returns Promise containing the status of the create channel order, note that the wait function returns the genesis block
    */
    async createChannel(
        channel: Channel,
        createChannelRequest: CreateChannelRequest,
        timeout: number = 60000
    ): Promise<{
        data: Object,
        wait: () => Promise<Object>,
    }> {
        return this.mainUserClient.createChannel(channel, createChannelRequest, timeout)
    }

    /**
    * Calls the orderer to update an existing channel. After the channel updates are successfully processed by the orderer, the orderer cuts a new block containing the new channel configuration and delivers it to all the participating peers in the channel.
    * @param channel - The channel object to users
    * @param updateChannelRequest - The options for updating a channel on the network
    * @param {Array<byte>} [updateChannelRequest.channelEnvelope] - The envelope for the updated channel, required if no config is specified
    * @param {Array<byte>} [updateChannelRequest.channelConfig] - The configuration for the updated channel, required if no envelope is specified
    * @param {Array<ConfigSignature>} [updateChannelRequest.signatures] - The signatures required for the updated channel, required if no envelope is specified
    * @param {number} [timeout=60000] - The maximum number of ms to wait for the channel to be updated
    * @returns Promise containing the status of the update channel order
    */
    async updateChannel(
        channel: Channel,
        createChannelRequest: CreateChannelRequest,
        timeout: number = 60000
    ): Promise<{
        data: Object,
        wait: () => Promise<any>,
    }> {
        return this.mainUserClient.updateChannel(channel, createChannelRequest)
    }

    /**
    * This method sends a join channel proposal to one or more endorsing peers.
    * @param channel - The channel object to use
    * @param [joinChannelRequest] - The options for joining the channel
    * @param {Array<Peer>} [joinChannelRequest.targets] - An array of Peer objects or Peer names that will be asked to join this channel.
    * @param {GenesisBlock} [joinChannelRequest.genesisBlock] - The genesis block for the channel
    * @param {number} [timeout=60000] - The maximum number of ms to wait for a peers to join
    * @returns a promise containing an array of proposal response objects
    */
    async joinChannel(
        channel: Channel,
        joinChannelRequest: JoinChannelRequest = {},
        timeout: number = 60000
    ): Promise<{
        data: Array<Array<Object>>,
        wait: () => Promise<any>,
    }> {
        const peers = _.clone(channel.getPeers().filter(peer => isFcwPeer(peer)))
        const joinChannelCalls = []
        this.userClients.forEach(userClient => {
            const ownedPeers = remove(peers, peer =>
                peer.getAdminMspIds().includes(userClient.getOrganizationConfig().mspId)
            )
            if (ownedPeers.length > 0) {
                const ownedPeersJoinChannelOpts = {
                    ...joinChannelRequest,
                    targets: ownedPeers,
                }
                joinChannelCalls.push(userClient.joinChannel(channel, ownedPeersJoinChannelOpts))
            }
        })
        const joinChannelResponses = await Promise.all(joinChannelCalls)

        return {
            data: joinChannelResponses.map(joinChannelResponse => joinChannelResponse.data),
            wait: () => Promise.all(joinChannelResponses.map(joinChannelResponse => joinChannelResponse.wait())),
        }
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
    * @returns a promise containing a proposal response object
    */
    async installChaincode(
        chaincodeInstallRequest: ChaincodeInstallRequest,
        timeout?: number
    ): Promise<{
        data: Array<Object>,
    }> {
        const peers = _.clone(chaincodeInstallRequest.targets.filter(peer => isFcwPeer(peer)))
        const installChaincodeCalls = []
        this.userClients.forEach(userClient => {
            const ownedPeers = remove(peers, peer =>
                peer.getAdminMspIds().includes(userClient.getOrganizationConfig().mspId)
            )
            if (ownedPeers.length > 0) {
                const ownedPeersChaincodeInstallRequest = {
                    ...chaincodeInstallRequest,
                    targets: ownedPeers,
                }
                installChaincodeCalls.push(userClient.installChaincode(ownedPeersChaincodeInstallRequest, timeout))
            }
        })
        const installChaincodeResponses = await Promise.all(installChaincodeCalls)
        return {
            data: installChaincodeResponses.map(installChaincodeResponse => installChaincodeResponse.data),
        }
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
    * @param [timeoutPeersOpts] - Configuration for waiting on peers for confirmation
    * @param {Array<Peer>} [timeoutPeersOpts.waitPeers] waitPeers - The peers to wait on until the chaincode is instantiated
    * @param {number} [timeoutPeersOpts.waitTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @returns a promise containing a ProposalResponseObject
    */
    instantiateChaincode(
        channel: Channel,
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        timeoutPeersOpts?: TimeoutPeersOpts
    ): Promise<{
        data: Object, // TODO elaborate
        wait: Function,
    }> {
        return this.mainUserClient.instantiateChaincode(channel, chaincodeInstantiateRequest, timeoutPeersOpts)
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
    * @param [timeoutPeersOpts] - Configuration for waiting on peers for confirmation
    * @param {Array<Peer>} [timeoutPeersOpts.waitPeers] waitPeers - The peers to wait on until the chaincode is instantiated
    * @param {number} [timeoutPeersOpts.waitTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @returns  a promise containing a ProposalResponseObject
    */
    upgradeChaincode(
        channel: Channel,
        chaincodeUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        timeoutPeersOpts?: TimeoutPeersOpts
    ): Promise<{
        data: Object,
        wait: Function,
    }> {
        return this.mainUserClient.upgradeChaincode(channel, chaincodeUpgradeRequest, timeoutPeersOpts)
    }

    /**
    * Sends a Transaction Proposal to peers in a channel
    * @param channel - The channel object to use
    * @param transactionProposalRequest - The arguments for the transaction proposal request
    * @param {string} transactionProposalRequest.chaincodeId - The id of the channel
    * @param {Array<Peer>} [transactionProposalRequest.targets] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
    * @param {string} [transactionProposalRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
    * @param {Array<string>} [transactionProposalRequest.args] - The arguments to suppied to the chaincode function
    * @param {string} [transactionProposalRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
    * @returns A promise containing the transaction ID and transaction request objects
    */
    async sendTransactionProposal(
        channel: Channel,
        transactionProposalRequest: TransactionProposalRequest
    ): Promise<{
        data: {
            txId: TransactionID,
            transactionRequest: TransactionRequest,
        },
    }> {
        return this.mainUserClient.sendTransactionProposal(channel, transactionProposalRequest)
    }

    /**
    * Sends a Transaction to peers in a channel
    * @param channel - The channel object to use
    * @param transactionId - The transaction ID to wait on
    * @param transactionRequest - An object containing the proposal responses from the peers and the proposal
    * @param [timeoutPeersOpts] - Configuration for waiting on peers for confirmation
    * @param {Array<Peer>} [timeoutPeersOpts.waitPeers] waitPeers - The peers to wait on until the chaincode is instantiated
    * @param {number} [timeoutPeersOpts.waitTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @returns A promise containing the response to the transaction
    */
    async sendTransaction(
        channel: Channel,
        transactionId: string,
        transactionRequest: TransactionRequest,
        timeoutPeersOpts?: TimeoutPeersOpts
    ): Promise<{
        data: {
            status: string,
        },
        wait: Function,
    }> {
        return this.mainUserClient.sendTransaction(channel, transactionId, transactionRequest, timeoutPeersOpts)
    }

    /**
    * Sends a Transaction Proposal to a peer in the channel and formats the response
    * @param channel - The channel object to use
    * @param queryChaincodeRequest - The arguments for the transaction proposal request
    * @param {string} queryChaincodeRequest.chaincodeId - The id of the channel
    * @param {Peer} [queryChaincodeRequest.target] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
    * @param {string} [queryChaincodeRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
    * @param {Array<string>} [queryChaincodeRequest.args] - The arguments to suppied to the chaincode function
    * @param {string} [queryChaincodeRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
    * @returns A formatted proposal response from a single peer
    */
    queryChaincode(
        channel: Channel,
        queryChaincodeRequest: QueryChaincodeRequest
    ): Promise<{
        data: { status: number, message: string, payload: Buffer },
    }> {
        return this.mainUserClient.queryChaincode(channel, queryChaincodeRequest)
    }

    /**
    * Sends a Transaction Proposal to peers in a channel and formats the response
    * @param channel - The channel object to use
    * @param transactionProposalRequest - The arguments for the transaction proposal request
    * @param {string} transactionProposalRequest.chaincodeId - The id of the channel
    * @param {Array<Peer>} [transactionProposalRequest.targets] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
    * @param {string} [transactionProposalRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
    * @param {Array<string>} [transactionProposalRequest.args] - The arguments to suppied to the chaincode function
    * @param {string} [transactionProposalRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
    * @param [timeoutPeersOpts] - Configuration for waiting on peers for confirmation
    * @param {Array<Peer>} [timeoutPeersOpts.waitPeers] waitPeers - The peers to wait on until the chaincode is instantiated
    * @param {number} [timeoutPeersOpts.waitTimeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
    * @returns An object holding the transaction response, transaction proposal response, and transaction ID
    */
    async invokeChaincode(
        channel: Channel,
        transactionProposalRequest: TransactionProposalRequest,
        timeoutPeersOpts?: TimeoutPeersOpts
    ): Promise<{
        data: {
            transactionResponse: { status: string },
            proposalResponse: {
                status: number,
                message: string,
                payload: Buffer,
            },
            transactionId: string,
        },
        wait: Function,
    }> {
        return this.mainUserClient.invokeChaincode(channel, transactionProposalRequest, timeoutPeersOpts)
    }
}

export function isMultiUserClient(obj: any) {
    return obj.bindChannel && !obj.getOrganizationConfig
}
