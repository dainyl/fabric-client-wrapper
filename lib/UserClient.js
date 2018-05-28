// @flow

import _ from "lodash/fp"
import type FabricClient from "fabric-client"
import type FabricCAClient from "fabric-ca-client" // eslint-disable-line import/no-extraneous-dependencies
import type Channel from "fabric-client/lib/Channel"
import type Peer from "fabric-client/lib/Peer"
import type TransactionID from "fabric-client/lib/TransactionID"
import type { CryptoSuite, KeyValueStore } from "fabric-client/lib/api"
import type {
    ChannelEnvelope,
    ChannelConfig,
    TransactionRequest,
    ConnectionOpts,
    ChaincodeInstallRequest,
    Policy,
    ProposalResponse,
    ProposalResponseObject
} from "./FABRIC_FLOW_TYPES"
import type { RegisterRequest } from "./FABRIC_CA_FLOW_TYPES"
import wait from "./wait"
import { MEMBER_ROLE } from "./shared"
import pickPeersForPolicy from "./pickPeersForPolicy"
import { isFcwPeer } from "./fabric-client-extended/FcwPeer"
import {
    newEventHubPeer,
    isEventHubPeer
} from "./fabric-client-extended/EventHubPeer"
import { isEventHubChannel } from "./fabric-client-extended/EventHubChannel"

export type CreateChannelRequest = {
    envelope?: ChannelEnvelope,
    config?: ChannelConfig,
    signatures?: Array<Object>,
    txId?: TransactionID
}

export type TransactionProposalRequest = {
    chaincodeId: string,
    targets?: Array<Peer>,
    txId?: TransactionID,
    fcn?: string,
    args?: Array<string>,
    argbytes?: Buffer,
    transientMap?: Object
}

export type QueryChaincodeRequest = {
    chaincodeId: string,
    target?: Peer,
    fcn?: string,
    args?: Array<string>,
    transientMap?: Object
}

export type JoinChannelRequest = {
    targets?: Array<Peer>,
    genesisBlock?: Object,
    txId?: TransactionID
}

export type FcwChaincodeInstantiateUpgradeRequest = {
    targets?: Array<Peer> | Policy,
    chaincodeType?: string,
    chaincodeId: string,
    chaincodeVersion: string,
    txId?: TransactionID,
    transientMap?: Object,
    fcn?: string,
    args: Array<string>,
    "endorsement-policy"?: Object
}

export type WaitOpts = {
    disable: boolean,
    timeout: number
}

// TODO
export type FcwTransactionProposalRequest = Object

/**
 * @typedef {Function} WaitSendTransaction
 * @param [opts] - Options for wait function
 * @param {Array<Peer>} [opts.targets] - The peers to use, defaults to peers used for the function the wait is attached to
 * @param {boolean} [opts.race=false] - Option to only wait for a single peer
 * @param {number} [opts.pollInterval=1000] - Time between polls
 * @param {number} [opts.timeout] - Max time to wait for peers. Defaults to 10 Minutes for instantiate/upgrade chaincode operations, 1 minute for all other operations
 * @returns {Promise<any>} - Resolves once peer(s) have responded
 */
export type WaitSendTransaction = (
    {
        targets?: Array<Peer>,
        race?: boolean,
        pollInterval: number,
        timeout: number
    } | void
) => Promise<any>

/**
 * @typedef {Function} WaitPoll
 * @param [opts] - Options for wait function
 * @param {Array<Peer>} [opts.targets] - The peers to use, defaults to peers used for the function the wait is attached to
 * @param {number} [opts.pollInterval=1000] - Time between polls
 * @param {number} [opts.timeout=60000] - Max time to wait for peers
 * @returns Resolves once peer(s) have responded
 */
export type WaitPoll = (
    {
        targets?: Array<Peer>,
        pollInterval: number,
        timeout: number
    } | void
) => Promise<any>

/**
 * @typedef {Function} WaitEvent
 * @param [opts] - Options for wait function
 * @param {Array<Peer>} [opts.targets] - The peers to use, defaults to peers used for the function the wait is attached to
 * @param {number} [opts.timeout=60000] - Max time to wait for peers
 * @returns Resolves once peer(s) have responded
 */
export type WaitTimeout = (
    {
        targets?: Array<Peer>,
        timeout: number
    } | void
) => Promise<any>

/**
 * @typedef {Function} WaitSimple
 * @returns Resolves once peer(s) have responded
 */
export type WaitSimple = () => Promise<any>

/**
 * @typedef {Function} WaitCreateChannel
 * @param [opts] - Options for wait function
 * @param {number} [opts.pollInterval=1000] - Time between polls
 * @param {number} [opts.timeout=60000] - Max time to wait for peers
 * @returns The genesis block of the channel. Resolves once peer(s) have responded
 */
export type WaitCreateChannel = (
    {
        pollInterval: number,
        timeout: number
    } | void
) => Promise<Object>

/**
 * Response to an chaincode invoke
 */
export type InvokeChaincodeResponse = {
    data: {
        transactionResponse: { status: string },
        proposalResponse: {
            status: number,
            message: string,
            payload: Buffer
        },
        transactionId: string
    },
    wait?: Function
}

/**
 * Response to a chaincode query
 */
export type QueryChaincodeResponse = {
    data: { status: number, message: string, payload: Buffer }
}

/**
 * Response to sending a chaincode transaction proposal
 */
export type SendTransactionProposalResponse = {
    data: {
        txId: TransactionID,
        transactionRequest: TransactionRequest
    }
}

/**
 * Response to sending a chaincode transaction
 */
export type SendTransactionResponse = {
    data: {
        status: string
    },
    wait?: Function
}

function validateProposalResponses(proposalResponses: Array<Object>) {
    if (
        !proposalResponses.every(
            proposalResponse =>
                proposalResponse.response &&
                proposalResponse.response.status === 200
        )
    ) {
        throw proposalResponses.find(
            proposalResponse =>
                !proposalResponse.response ||
                proposalResponse.response.status !== 200
        )
    }
}

function waitTransactionEventHubPeer(
    channel: Channel,
    eventHubPeer: Peer,
    transactionId: string,
    timeout: number
) {
    const eventHubManager = eventHubPeer.getEventHubManager()
    return new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
            eventHubManager.unregisterTxEvent(transactionId)
            reject(new Error("wait Transaction TIMEOUT"))
        }, timeout)

        eventHubManager.registerTxEvent(transactionId, (tx, code) => {
            clearTimeout(handle)
            eventHubManager.unregisterTxEvent(transactionId)
            if (code !== "VALID") {
                reject(new Error(`Invalid code ${code}`))
            } else {
                resolve(eventHubPeer)
            }
        })

        channel
            .queryTransaction(transactionId, eventHubPeer)
            .then(() => {
                clearTimeout(handle)
                eventHubManager.unregisterTxEvent(transactionId)
                resolve(eventHubPeer)
            })
            .catch(error => {
                if (
                    !error.message ||
                    !error.message.includes("error Entry not found in index")
                ) {
                    clearTimeout(handle)
                    eventHubManager.unregisterTxEvent(transactionId)
                    resolve(eventHubPeer)
                }
            })
    })
}

async function waitChaincodeRunningPeer(
    userClient,
    channel,
    peer,
    chaincodeId,
    timeout,
    pollInterval
) {
    let endDate = new Date()
    endDate = new Date(endDate.getTime() + timeout)
    while (new Date() < endDate) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await userClient.sendTransactionProposal(channel, {
                chaincodeId,
                targets: [peer],
                args: ["_"] // TODO explore why zero args seems to hang
            })
            return peer
        } catch (error) {
            if (
                !error.message ||
                !error.message.includes("premature execution")
            ) {
                return peer
            }
            await wait(pollInterval) // eslint-disable-line no-await-in-loop
        }
    }
    throw new Error("Peer did not startup chaincode in time")
}

async function waitTransactionPollingPeer(
    channel,
    peer,
    transactionId,
    timeout,
    pollInterval
) {
    let endDate = new Date()
    endDate = new Date(endDate.getTime() + timeout)
    while (new Date() < endDate) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await channel.queryTransaction(transactionId, peer)
            return peer
        } catch (error) {
            if (
                !error.message ||
                !error.message.includes("error Entry not found in index")
            ) {
                return peer
            }
            await wait(pollInterval) // eslint-disable-line no-await-in-loop
        }
    }
    throw new Error("External Org Peer did not receive transaction in time")
}

function createWaitSendTransaction(
    channel: Channel,
    defaultPeers: Array<Peer>,
    transactionId: string,
    defaultTimeout: number,
    instantiateChaincodeId,
    userClient: any
): WaitSendTransaction {
    return (
        { targets = null, race = false, pollInterval = 1000, timeout } = {}
    ) => {
        const myTimeout =
            typeof timeout !== "undefined" ? timeout : defaultTimeout
        const usedPeers = targets || defaultPeers
        const eventHubPeersPromises = usedPeers
            .filter(peer => isEventHubPeer(peer))
            .map(peer =>
                waitTransactionEventHubPeer(
                    channel,
                    peer,
                    transactionId,
                    myTimeout
                )
            )
        const pollingPeersPromises = usedPeers
            .filter(peer => !isEventHubPeer(peer))
            .map(peer =>
                waitTransactionPollingPeer(
                    channel,
                    peer,
                    transactionId,
                    myTimeout,
                    pollInterval
                )
            )

        let promises

        if (!instantiateChaincodeId) {
            promises = eventHubPeersPromises.concat(pollingPeersPromises)
        } else {
            promises = eventHubPeersPromises
                .concat(pollingPeersPromises)
                .map(promise =>
                    promise.then(peer =>
                        waitChaincodeRunningPeer(
                            userClient,
                            channel,
                            peer,
                            instantiateChaincodeId,
                            myTimeout,
                            pollInterval
                        )
                    )
                )
        }

        if (race) {
            return Promise.race(promises)
        }
        return Promise.all(promises)
    }
}

function createWaitTransactionLight(
    channel: Channel,
    transactionId: string,
    timeout: number = 60000
) {
    const eventHubManager = channel.getEventHubManager()
    const prom = new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
            eventHubManager.unregisterTxEvent(transactionId)
            reject(new Error("wait Transaction TIMEOUT"))
        }, timeout)

        eventHubManager.registerTxEvent(transactionId, (tx, code) => {
            clearTimeout(handle)
            eventHubManager.unregisterTxEvent(transactionId)
            if (code !== "VALID") {
                reject(new Error(`Invalid code ${code}`))
            } else {
                resolve()
            }
        })
    })
    return () => prom
}

function isChannelBlockEvent(channel, block) {
    // Config block must only contain one transaction
    if (block.data.data.length === 1) {
        const channelHeader = block.data.data[0].payload.header.channel_header
        // we must check that this block came from the channel we asked the peer to join
        if (channelHeader.channel_id === channel.getName()) {
            return true
        }
    }
    return false
}

export type UserClientOpts = {
    client: FabricClient,
    mspId: string,
    cryptoSuite: CryptoSuite,
    store?: KeyValueStore,
    fabricCAClient?: FabricCAClient,
    enrollmentSecret?: string,
    roles?: Array<string>
}

/** Class representing a user and also a wrapper over FabricClient
 * @param opts - The options for creating a UserClient
 * @param {FabricClient} opts.client - The FabricClient object to wrap
 * @param {string} opts.mspId - The MSP ID of the organisation the user is attached to
 * @param {KeyValueStore} [opts.store] - The store which the user's credentials are stored in
 * @param {CryptoSuite} opts.cryptoSuite - The cryptoSuite for the user
 * @param {FabricCAClient} [opts.fabricCAClient] - The FabricCAClient to use for registering users
 * @param {Array<string>} [opts.roles] - The set of roles for the user
 * @param {string} [opts.enrollmentSecret] - The enrollment secret for the user
 */
export default class UserClient {
    client: FabricClient
    mspId: string
    store: ?KeyValueStore
    cryptoSuite: CryptoSuite
    fabricCAClient: ?FabricCAClient
    enrollmentSecret: ?string

    constructor({
        client,
        mspId,
        cryptoSuite,
        store,
        fabricCAClient,
        enrollmentSecret,
        roles
    }: UserClientOpts) {
        this.client = client
        this.mspId = mspId
        this.cryptoSuite = cryptoSuite
        this.store = store
        if (fabricCAClient) {
            this.setFabricCAClient(fabricCAClient)
        }
        if (enrollmentSecret) {
            this.setEnrollmentSecret(enrollmentSecret)
        }
        // do not override existing roles as they come from persisted user state
        if (!this.getRoles()) {
            this.setRoles(roles || [MEMBER_ROLE])
        }
    }

    /**
     * Gets the underlying FabricClient instance
     */
    getClient(): FabricClient {
        return this.client
    }

    /**
     * Gets the mspId for the user's organisation
     */
    getMspId(): string {
        return this.mspId
    }

    /**
     * Gets the cryptoSuite for the user
     */
    getCryptoSuite(): CryptoSuite {
        return this.cryptoSuite
    }

    /**
     * Gets the store for the user
     */
    getStore(): KeyValueStore {
        return this.store
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
        if (this.store) {
            this.client.saveUserToStateStore()
        }
    }

    /**
     * Gets the FabricCAClient for the user
     */
    getFabricCAClient(): FabricCAClient {
        if (this.fabricCAClient) {
            return this.fabricCAClient
        }
        throw new Error("No FabricCAClient set")
    }

    /**
     * Sets the FabricCAClient for the user
     * @param fabricCAClient - The FabricCAClient for the CA the user is associated with
     */
    setFabricCAClient(fabricCAClient: FabricCAClient) {
        this.fabricCAClient = fabricCAClient
    }

    /**
     * Gets the enrollment secret for the user
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
    newEventHubPeer(opts: {
        requestUrl: string,
        eventUrl: string,
        peerOpts: ConnectionOpts,
        eventHubOpts: ConnectionOpts,
        role: string | void
    }): Peer {
        return newEventHubPeer({
            ...opts,
            client: this.client,
            mspId: this.mspId
        })
    }

    /**
     * This method registers a new user in the CA, requires an admin of the CA
     * @param registerRequest - The register request
     * @returns The enrollment secret to use when this user enrolls
     */
    async registerUserInCA(registerRequest: RegisterRequest): Promise<string> {
        const caAdminUser = this.client.getUserContext()
        const fabricCAClient = this.getFabricCAClient()
        return fabricCAClient.register(registerRequest, caAdminUser)
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

    /**
     * Returns a new TransactionID object. Fabric transaction ids are constructed as a hash of a nonce concatenated with the signing identity's serialized bytes. The TransactionID object keeps the nonce and the resulting id string bundled together as a coherent pair.
     */
    newTransactionID(): TransactionID {
        return this.client.newTransactionID()
    }

    /**
     * Queries the target peer for the names of all the channels that a peer has joined.
     */
    queryChannels(peer: Peer) {
        return this.client.queryChannels(peer)
    }

    /**
     * Queries the installed chaincodes on a peer.
     */
    queryInstalledChaincodes(peer: Peer) {
        return this.client.queryInstalledChaincodes(peer)
    }

    /**
     * Queries for various useful information on the state of the Channel (height, known peers).
     */
    queryChannelInfo(channel: Channel, target: Peer) {
        return this.bindChannel(channel).queryInfo(target)
    }

    /**
     * Queries the ledger on the target peer for instantiated chaincodes on this channel.
     */
    queryInstantiatedChaincodes(channel: Channel, target: Peer) {
        return this.bindChannel(channel).queryInstantiatedChaincodes(target)
    }

    /**
     * Queries the ledger on the target peer for Transaction by id.
     */
    queryTransaction(channel: Channel, txId: string, target: Peer) {
        return this.bindChannel(channel).queryTransaction(txId, target)
    }

    /**
     * Returns whether a chaincode has been installed on all supplied peers owned by the clients organization
     */
    async isChaincodeInstalled(
        channelOrPeers: Channel | Array<Peer>,
        chaincodeId: string,
        chaincodeVersion?: string
    ) {
        const peers = (Array.isArray(channelOrPeers)
            ? channelOrPeers
            : (channelOrPeers: Channel).getPeers()
        ).filter(
            peer =>
                isFcwPeer(peer) && peer.getAdminMspIds().includes(this.mspId)
        )
        const responses = await Promise.all(
            peers.map(peer => this.queryInstalledChaincodes(peer))
        )
        const lambda = chaincodeVersion
            ? chaincodeInfo =>
                  chaincodeInfo.name === chaincodeId &&
                  chaincodeInfo.version === chaincodeVersion
            : chaincodeInfo => chaincodeInfo.name === chaincodeId
        return responses.every(response => response.chaincodes.some(lambda))
    }

    /**
     * Returns whether a channel has been created
     */
    async isChannelCreated(channel: Channel): Promise<boolean> {
        let result: boolean = true
        try {
            await this.bindChannel(channel).getGenesisBlock({
                txId: this.newTransactionID()
            })
        } catch (error) {
            if (!error.message || !error.message.includes("NOT_FOUND")) {
                throw error
            }
            result = false
        }
        return result
    }

    /**
     * Returns whether a channel has been joined by all peers owned by the clients organization in the channel object
     */
    async isChannelJoined(channel: Channel): Promise<boolean> {
        const peers = channel
            .getPeers()
            .filter(
                peer =>
                    isFcwPeer(peer) &&
                    peer.getAdminMspIds().includes(this.mspId)
            )
        if (peers.length === 0) {
            throw new Error(
                `Error cannot call isChannelJoined, channel contains no peers that are owned by this user's Organisation ${
                    this.mspId
                }`
            )
        }
        const channelName = channel.getName()
        const responses = await Promise.all(
            peers.map(peer => this.queryChannels(peer))
        )
        return responses.every(response =>
            response.channels.some(
                channelInfo => channelInfo.channel_id === channelName
            )
        )
    }

    /**
     * Returns whether a chaincode has been instantiated on a channel
     */
    async isChaincodeInstantiated(
        channel: Channel,
        chaincodeId: string,
        chaincodeVersion?: string
    ): Promise<boolean> {
        const target = channel
            .getPeers()
            .find(
                peer =>
                    isFcwPeer(peer) &&
                    peer.getAdminMspIds().includes(this.mspId)
            )
        if (!target) {
            throw new Error(
                `Error cannot call isChaincodeInstantiated, channel contains no peers that are owned by this user's Organisation ${
                    this.mspId
                }`
            )
        }
        const response = await this.queryInstantiatedChaincodes(channel, target)
        const lambda = chaincodeVersion
            ? chaincodeInfo =>
                  chaincodeInfo.name === chaincodeId &&
                  chaincodeInfo.version === chaincodeVersion
            : chaincodeInfo => chaincodeInfo.name === chaincodeId
        return response.chaincodes.some(lambda)
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
     * Calls the orderer to start building the new channel. A channel typically has more than one participating organizations. To create a new channel, one of the participating organizations should call this method to submit the creation request to the orderer service. Once the channel is successfully created by the orderer, the next step is to have each organization's peer nodes join the channel, by sending the channel configuration to each of the peer nodes. The step is accomplished by calling the joinChannel() method.
     * @param channel - The channel object to users
     * @param createChannelRequest - The options for building a new channel on the network
     * @param {Array<byte>} [createChannelRequest.envelope] - The envelope for the new channel, required if no config is specified
     * @param {Array<byte>} [createChannelRequest.config] - The configuration for the new channel, required if no envelope is specified
     * @param {Array<ConfigSignature>} [createChannelRequest.signatures] - The signatures required for the new channel, required if no envelope is specified
     * @param {TransactionID} [createChannelRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @returns Promise containing the status of the create channel order, note that the wait function returns the genesis block
     */
    async createChannel(
        channel: Channel,
        { envelope, config, signatures, txId }: CreateChannelRequest
    ): Promise<{
        data: Object,
        wait: WaitCreateChannel
    }> {
        const userChannel = this.bindChannel(channel)
        const channelName = userChannel.getName()
        const request = {
            envelope,
            config,
            signatures,
            name: channelName,
            orderer: userChannel.getOrderers()[0],
            txId: txId || this.newTransactionID()
        }

        const data = await this.client.createChannel(request)
        if (data.status !== "SUCCESS") {
            throw new Error(data.status)
        }
        return {
            data,
            wait: async (
                { timeout, pollInterval } = {
                    timeout: 60000,
                    pollInterval: 1000
                }
            ) => {
                let endDate = new Date()
                endDate = new Date(endDate.getTime() + timeout)
                while (new Date() < endDate) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const genesisBlock = await userChannel.getGenesisBlock({
                            txId: this.newTransactionID()
                        })
                        return genesisBlock
                    } catch (error) {
                        if (
                            !error.message ||
                            !error.message.includes("NOT_FOUND")
                        ) {
                            throw error
                        }
                        await wait(pollInterval) // eslint-disable-line no-await-in-loop
                    }
                }
                throw new Error("Channel Creation Timed Out")
            }
        }
    }

    /**
     * Listens for block events for a single channel
     * Internal method not meant to be called directly
     * @ignore
     */
    createBlockEventPromise(
        channel: Channel,
        targets: Array<Peer>,
        timeout: number = 60000,
        earlyResolveFunc: ?Function
    ): Promise<void> {
        const filteredTargets = targets.filter(
            peer => peer.getMspId() === this.getMspId()
        )
        return Promise.race(
            filteredTargets.map(
                peer =>
                    new Promise(async (resolve, reject) => {
                        const eventHubManager = peer.getEventHubManager()
                        let blockRegistrationNumber
                        const handle = setTimeout(() => {
                            eventHubManager.unregisterBlockEvent(
                                blockRegistrationNumber
                            )
                            reject(new Error("Error: Timeout"))
                        }, timeout)
                        blockRegistrationNumber = eventHubManager.registerBlockEvent(
                            block => {
                                if (isChannelBlockEvent(channel, block)) {
                                    clearTimeout(handle)
                                    eventHubManager.unregisterBlockEvent(
                                        blockRegistrationNumber
                                    )
                                    resolve()
                                }
                            },
                            error => {
                                reject(error)
                            }
                        )
                        if (earlyResolveFunc) {
                            const isEarlyResolve = await earlyResolveFunc(peer)
                            if (isEarlyResolve) {
                                clearTimeout(handle)
                                eventHubManager.unregisterBlockEvent(
                                    blockRegistrationNumber
                                )
                                resolve()
                            }
                        }
                    })
            )
        )
    }

    /**
     * Listens for block events for a join channel request
     * Internal method not meant to be called directly
     * @ignore
     */
    newJoinChannelWait(
        channel: Channel,
        targets: Array<Peer>,
        timeout: number = 60000
    ): Promise<void> {
        return this.createBlockEventPromise(
            channel,
            targets,
            timeout,
            async peer => {
                const response = await this.queryChannels(peer)
                return response.channels.some(
                    channelInfo => channelInfo.channel_id === channel.getName()
                )
            }
        )
    }

    /**
     * Calls the orderer to update an existing channel. After the channel updates are successfully processed by the orderer, the orderer cuts a new block containing the new channel configuration and delivers it to all the participating peers in the channel.
     * @param channel - The channel object to users
     * @param updateChannelRequest - The options for updating a channel on the network
     * @param {Array<byte>} [updateChannelRequest.envelope] - The envelope for the updated channel, required if no config is specified
     * @param {Array<byte>} [updateChannelRequest.config] - The configuration for the updated channel, required if no envelope is specified
     * @param {Array<ConfigSignature>} [updateChannelRequest.signatures] - The signatures required for the updated channel, required if no envelope is specified
     * @param {TransactionID} [updateChannelRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param [waitOpts] - The options for the wait function
     * @param {boolean} [waitOpts.disable=false] - Disables wait function. Enable if you do not want to listen to peers for confirmation
     * @param {Array<Peer>} [waitOpts.targets] - The peers to use, defaults to peers used for the function the wait is attached to
     * @param {number} [waitOpts.timeout=60000] - Max time to wait for peers
     * @returns Promise containing the status of the update channel order
     */
    async updateChannel(
        channel: Channel,
        { envelope, config, signatures, txId }: CreateChannelRequest,
        {
            disable = false,
            timeout,
            targets
        }: {
            disable: boolean,
            timeout?: number,
            targets?: Array<Peer>
        } = {}
    ): Promise<{
        data: Object,
        wait: WaitSimple
    }> {
        const userChannel = this.bindChannel(channel)
        const channelName = userChannel.getName()
        const request = {
            envelope,
            config,
            signatures,
            name: channelName,
            orderer: userChannel.getOrderers()[0],
            txId: txId || this.newTransactionID()
        }

        const waitPeers = (targets || userChannel.getPeers()).filter(peer =>
            isEventHubPeer(peer)
        )

        let waitPromise

        if (disable || waitPeers.length !== 0) {
            waitPromise = this.createBlockEventPromise(
                userChannel,
                waitPeers,
                timeout
            )
        }

        const data = await this.client.updateChannel(request)
        if (data.status !== "SUCCESS") {
            throw new Error(data.status)
        }

        return {
            data,
            wait: () => {
                if (disable) {
                    throw new Error(
                        "Error: wait() is disable on this updateChannel call"
                    )
                }
                if (waitPeers.length === 0) {
                    throw new Error(
                        "Error: wait() on updateChannel requires at least one EventHubPeer"
                    )
                }
                return waitPromise
            }
        }
    }

    /**
     * This method sends a join channel proposal to one or more endorsing peers.
     * @param channel - The channel object to use
     * @param [joinChannelRequest] - The options for joining the channel
     * @param {Array<Peer>} [joinChannelRequest.targets] - An array of Peer objects or Peer names that will be asked to join this channel.
     * @param {Block} [joinChannelRequest.genesisBlock] - The genesis block for the channel
     * @param {TransactionID} [joinChannelRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {number} [timeout] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error. This overrides the default timeout of the Peer instance and the global timeout in the config settings.
     * @returns a promise containing an array of proposal response objects
     */
    async joinChannel(
        channel: Channel,
        { targets, genesisBlock, txId }: JoinChannelRequest = {},
        timeout?: number
    ): Promise<{
        data: Array<ProposalResponse>,
        wait: WaitTimeout
    }> {
        const userChannel = this.bindChannel(channel)
        const channelGenesisBlock =
            genesisBlock ||
            (await userChannel.getGenesisBlock({
                txId: this.newTransactionID()
            }))
        const peers =
            targets ||
            userChannel
                .getPeers()
                .filter(
                    peer =>
                        isFcwPeer(peer) &&
                        peer.getAdminMspIds().includes(this.mspId)
                )
        const request = {
            targets: peers,
            txId: txId || this.newTransactionID(),
            block: channelGenesisBlock
        }
        if (peers.length === 0) {
            return {
                data: [],
                wait: () => Promise.resolve()
            }
        }

        const peerProposalResponses = await userChannel.joinChannel(
            request,
            timeout
        )

        validateProposalResponses(peerProposalResponses)

        return {
            data: peerProposalResponses,
            wait: (waitOpts = {}) => {
                const waitPeers = (waitOpts.targets || peers).filter(peer =>
                    isEventHubPeer(peer)
                )
                if (peers.length === 0) {
                    throw new Error(
                        "Error: wait() on joinChannel requires at least one EventHubPeer"
                    )
                }
                return this.newJoinChannelWait(
                    userChannel,
                    waitPeers,
                    waitOpts.timeout
                )
            }
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
        data: ProposalResponseObject
    }> {
        const data = await this.client.installChaincode(
            chaincodeInstallRequest,
            timeout
        )
        validateProposalResponses(data[0])
        return data
    }

    /**
     * Sends a chaincode instantiate or upgrade proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
     * Internal method not meant to be called directly
     * @ignore
     */
    async instantiateUpgradeChaincode(
        channel: Channel,
        chaincodeInstantiateUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        timeout: number = 60000,
        upgrade: boolean = false
    ): Promise<{
        data: ProposalResponseObject,
        wait: WaitSendTransaction
    }> {
        const userChannel = this.bindChannel(channel)
        const request = Object.assign({}, chaincodeInstantiateUpgradeRequest)
        if (request.targets && !Array.isArray(request.targets)) {
            request.targets = pickPeersForPolicy(
                userChannel.getPeers(),
                (request.targets: any)
            )
        }
        if (!request.txId) {
            request.txId = this.newTransactionID()
        }

        const transactionId = request.txId.getTransactionID()

        const [proposalResponses, proposal] = await (upgrade
            ? userChannel.sendUpgradeProposal(request, timeout)
            : userChannel.sendInstantiateProposal(request, timeout))

        validateProposalResponses(proposalResponses)

        const transactionRequest = {
            proposalResponses,
            proposal
        }

        const data = await userChannel.sendTransaction(transactionRequest)

        return {
            data,
            wait: createWaitSendTransaction(
                userChannel,
                (request.targets: any) || channel.getPeers(),
                transactionId,
                600000,
                upgrade
                    ? false
                    : chaincodeInstantiateUpgradeRequest.chaincodeId,
                this
            )
        }
    }

    /**
     * Sends a chaincode instantiate proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
     * @param channel - The channel to use
     * @param chaincodeInstantiateRequest - The chaincode instantiation request to be made
     * @param {Array<Peer> | Policy} [chaincodeInstantiateRequest.targets] - An array of Peer objects that are used to satisfy the instantiation policy or a policy used to select peers from the channel. If targets is not specified Defaults to channel peers if not specified
     * @param {string} chaincodeInstantiateRequest.chaincodeId - Name of the chaincode
     * @param {string} chaincodeInstantiateRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
     * @param {TransactionID} [chaincodeInstantiateRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {string} [chaincodeInstantiateRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
     * @param {Map} [chaincodeInstantiateRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
     * @param {string} [chaincodeInstantiateRequest.fcn] - The function name to be returned when calling stub.GetFunctionAndParameters() in the target chaincode. Default is 'init'
     * @param {string[]} [chaincodeInstantiateRequest.args] - Array of string arguments to pass to the function identified by the fcn value
     * @param {Policy} [chaincodeInstantiateRequest.endorsement-policy] - EndorsementPolicy object for this chaincode (see examples below). If not specified, a default policy of "a signature by any member from any of the organizations corresponding to the array of member service providers" is used. WARNING: The default policy is NOT recommended for production, because this allows an application to bypass the proposal endorsement and send a manually constructed transaction, with arbitrary output in the write set, to the orderer directly. An application's own signature would allow the transaction to be successfully validated and committed to the ledger.
     * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns  a promise containing a ProposalResponseObject
     */
    instantiateChaincode(
        channel: Channel,
        chaincodeInstantiateRequest: FcwChaincodeInstantiateUpgradeRequest,
        timeout?: number
    ): Promise<{
        data: ProposalResponseObject,
        wait: WaitSendTransaction
    }> {
        return this.instantiateUpgradeChaincode(
            channel,
            chaincodeInstantiateRequest,
            timeout
        )
    }

    /**
     * Sends a chaincode upgrade proposal to one or more endorsing peers. A chaincode must be instantiated on a channel-by-channel basis before it can be used. The chaincode must first be installed on the endorsing peers where this chaincode is expected to run
     * @param channel - The channel to use
     * @param chaincodeUpgradeRequest - The chaincode upgrade request to be made
     * @param {Array<Peer> | Policy} [chaincodeInstantiateRequest.targets] - An array of Peer objects that are used to satisfy the instantiation policy or a policy used to select peers from the channel. If targets is not specified Defaults to channel peers if not specified
     * @param {string} chaincodeUpgradeRequest.chaincodeId - Name of the chaincode
     * @param {string} chaincodeUpgradeRequest.chaincodeVersion - Version string of the chaincode, such as 'v1'
     * @param {TransactionID} [chaincodeUpgradeRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {string} [chaincodeUpgradeRequest.chaincodeType] -  Type of chaincode. One of 'golang', 'car' or 'java'. Default is 'golang'. Note that 'java' is not supported as of v1.0.
     * @param {Map} [chaincodeUpgradeRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
     * @param {string} [chaincodeUpgradeRequest.fcn] - The function name to be returned when calling stub.GetFunctionAndParameters() in the target chaincode. Default is 'init'
     * @param {string[]} [chaincodeUpgradeRequest.args] - Array of string arguments to pass to the function identified by the fcn value
     * @param {Policy} [chaincodeUpgradeRequest.endorsement-policy] - EndorsementPolicy object for this chaincode (see examples below). If not specified, a default policy of "a signature by any member from any of the organizations corresponding to the array of member service providers" is used. WARNING: The default policy is NOT recommended for production, because this allows an application to bypass the proposal endorsement and send a manually constructed transaction, with arbitrary output in the write set, to the orderer directly. An application's own signature would allow the transaction to be successfully validated and committed to the ledger.
     * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns  a promise containing a ProposalResponseObject
     */
    upgradeChaincode(
        channel: Channel,
        chaincodeUpgradeRequest: FcwChaincodeInstantiateUpgradeRequest,
        timeout?: number
    ): Promise<{
        data: ProposalResponseObject,
        wait: WaitSendTransaction
    }> {
        return this.instantiateUpgradeChaincode(
            channel,
            chaincodeUpgradeRequest,
            timeout,
            true
        )
    }

    /**
     * Sends a Transaction Proposal to peers in a channel
     * @param channel - The channel object to use
     * @param transactionProposalRequest - The arguments for the transaction proposal request
     * @param {string} transactionProposalRequest.chaincodeId - The id of the channel
     * @param {Array<Peer>|Policy} [transactionProposalRequest.targets] - The peers to use for the transaction proposal or endorsement policy for the chaincode, falls back to the peers in the channel if unspecified
     * @param {TransactionID} [transactionProposalRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {string} [transactionProposalRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
     * @param {Array<string>} [transactionProposalRequest.args] - The arguments to suppied to the chaincode function
     * @param {string} [transactionProposalRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
     * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns A promise containing the transaction ID and transaction request objects
     */
    async sendTransactionProposal(
        channel: Channel,
        transactionProposalRequest: FcwTransactionProposalRequest,
        timeout: number = 60000
    ): Promise<SendTransactionProposalResponse> {
        const userChannel = this.bindChannel(channel)
        const request = Object.assign({}, transactionProposalRequest)

        if (request.targets && !Array.isArray(request.targets)) {
            request.targets = pickPeersForPolicy(
                userChannel.getPeers(),
                (request.targets: any)
            )
        }

        if (!request.txId) {
            request.txId = this.newTransactionID()
        }

        if (!request.args) {
            request.args = []
        }

        // send query
        const [
            proposalResponses,
            proposal
        ] = await userChannel.sendTransactionProposal(request, timeout)

        return {
            data: {
                txId: request.txId,
                transactionRequest: {
                    proposalResponses,
                    proposal
                }
            }
        }
    }

    /**
     * Sends a Transaction to peers in a channel
     * @param channel - The channel object to use
     * @param transactionId - The transaction ID to wait on
     * @param transactionRequest - An object containing the proposal responses from the peers and the proposal
     * @returns A promise containing the response to the transaction
     */
    async sendTransaction(
        channel: Channel,
        transactionId: string,
        transactionRequest: TransactionRequest,
        waitOpts?: WaitOpts
    ): Promise<SendTransactionResponse> {
        const userChannel = this.bindChannel(channel)
        let waitFun
        if (!waitOpts || !waitOpts.disable) {
            if (!isEventHubChannel(channel)) {
                throw new Error(
                    "Error: sentTransaction with wait enabled requires an EventHubChannel"
                )
            }
            const waitOptsTimeout =
                waitOpts && waitOpts.timeout ? waitOpts.timeout : undefined
            waitFun = createWaitTransactionLight(
                channel,
                transactionId,
                waitOptsTimeout
            )
        }

        const data = await userChannel.sendTransaction(transactionRequest)

        return {
            data,
            wait: waitFun
        }
    }

    /**
     * Sends a Transaction Proposal to a peer in the channel and formats the response
     * @param channel - The channel object to use
     * @param queryChaincodeRequest - The arguments for the transaction proposal request
     * @param {string} queryChaincodeRequest.chaincodeId - The id of the channel
     * @param {Peer} [queryChaincodeRequest.target] - The peers to use for the transaction proposal, falls back to the peers in the channel if unspecified
     * @param {TransactionID} [queryChaincodeRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {string} [queryChaincodeRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
     * @param {Array<string>} [queryChaincodeRequest.args] - The arguments to suppied to the chaincode function
     * @param {string} [queryChaincodeRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
     * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns A formatted proposal response from a single peer
     */
    queryChaincode(
        channel: Channel,
        queryChaincodeRequest: QueryChaincodeRequest,
        timeout: number = 60000
    ): Promise<QueryChaincodeResponse> {
        const request = { ...queryChaincodeRequest }
        if (request.target) {
            delete request.target
        }
        request.targets = queryChaincodeRequest.target
            ? [queryChaincodeRequest.target]
            : [channel.getPeers()[0]]
        return this.sendTransactionProposal(channel, request, timeout).then(
            response => {
                const proposalResponses =
                    response.data.transactionRequest.proposalResponses
                validateProposalResponses(proposalResponses)
                return {
                    data: proposalResponses[0].response
                }
            }
        )
    }

    /**
     * Sends a Transaction Proposal to peers in a channel and formats the response
     * @param channel - The channel object to use
     * @param transactionProposalRequest - The arguments for the transaction proposal request
     * @param {string} transactionProposalRequest.chaincodeId - The id of the channel
     * @param {Array<Peer>|Policy} [transactionProposalRequest.targets] - The peers to use for the transaction proposal or endorsement policy for the chaincode, falls back to the peers in the channel if unspecified
     * @param {TransactionID} [transactionProposalRequest.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {string} [transactionProposalRequest.fcn] - The function to be called on the chaincode, defaults to 'invoke'
     * @param {Array<string>} [transactionProposalRequest.args] - The arguments to suppied to the chaincode function
     * @param {string} [transactionProposalRequest.transientMap] - Map that can be used by the chaincode during intialization, but not saved in the ledger. Data such as cryptographic information for encryption can be passed to the chaincode using this technique
     * @param {number} [timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns An object holding the transaction response, transaction proposal response, and transaction ID
     */
    async invokeChaincode(
        channel: Channel,
        transactionProposalRequest: TransactionProposalRequest,
        timeout: number = 60000,
        waitOpts?: WaitOpts
    ): Promise<InvokeChaincodeResponse> {
        const {
            txId,
            transactionRequest
        } = (await this.sendTransactionProposal(
            channel,
            transactionProposalRequest,
            timeout
        )).data

        validateProposalResponses(transactionRequest.proposalResponses)
        if (
            !channel.compareProposalResponseResults(
                transactionRequest.proposalResponses
            )
        ) {
            throw new Error("Error: Proposal responses are not all equal")
        }
        const transactionResponse = await this.sendTransaction(
            channel,
            txId.getTransactionID(),
            transactionRequest,
            waitOpts
        )
        return {
            data: {
                transactionResponse: transactionResponse.data,
                proposalResponse:
                    transactionRequest.proposalResponses[0].response,
                transactionId: txId.getTransactionID()
            },
            wait: transactionResponse.wait
        }
    }
}
