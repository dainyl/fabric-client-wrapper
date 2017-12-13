// @flow

import type Peer from "fabric-client/lib/Peer"
import type Channel from "fabric-client/lib/Channel"
import type TransactionID from "fabric-client/lib/TransactionID"
import type { TransactionRequest, Policy } from "./FABRIC_FLOW_TYPES"
import type UserClient, {
    InvokeChaincodeResponse,
    QueryChaincodeResponse,
    SendTransactionProposalResponse,
    SendTransactionResponse
} from "./UserClient"
import type EventHubManager from "./EventHubManager"
import { isFcwChannel } from "./fabric-client-extended/FcwChannel"
import { isEventHubPeer } from "./fabric-client-extended/EventHubPeer"
import pickPeersForPolicy from "./pickPeersForPolicy"

function addArgsOrArgBytesToRequest(
    request: Object,
    argsOrArgBytes?: Array<string> | Buffer
) {
    if (Buffer.isBuffer(argsOrArgBytes)) {
        request.argbytes = (argsOrArgBytes: any)
    } else {
        request.args = (argsOrArgBytes: any)
    }
    return request
}

/** Class for issuing chaincode transactions
 * Creates a new object for issuing chaincode transactions or listening for chaincode events
 * @param userClient - The UserClient representing the user performing chaincode transactions
 * @param channel - The Channel object representing the channel to transact on
 * @param chaincodeId - The ID of the chaincode being transacted on
 * @param [defaultTargets] - An array of peers to transact with or the endorsement policy to select peers with
 */
export default class Transactor {
    userClient: UserClient
    channel: Channel
    chaincodeId: string
    endorsingPeers: Array<Peer> | void

    constructor(
        userClient: UserClient,
        channel: Channel,
        chaincodeId: string,
        defaultTargets?: Array<Peer> | Policy
    ) {
        this.userClient = userClient
        this.channel = channel
        this.chaincodeId = chaincodeId
        if (defaultTargets) {
            this.setPeers(defaultTargets)
        }
    }

    /**
     * Updates the endorsing peers that are used
     * @param {Array<Peer>|Policy} targets - An array of peers to transact with or the endorsement policy to select peers with
     */
    setPeers(targets: Array<Peer> | Policy): void {
        if (Array.isArray(targets)) {
            this.endorsingPeers = targets
        } else {
            this.endorsingPeers = pickPeersForPolicy(
                this.channel.getPeers(),
                targets
            )
        }
    }

    /**
     * Gets the UserClient
     */
    getUserClient(): UserClient {
        return this.userClient
    }

    /**
     * Gets the channel
     */
    getChannel(): Channel {
        return this.channel
    }

    /**
     * Gets the chaincode ID
     */
    getChaincodeId(): string {
        return this.chaincodeId
    }

    /**
     * Gets the endorsingPeers
     */
    getEndorsingPeers(): ?Array<Peer> {
        return this.endorsingPeers
    }

    /**
     * Performs a chaincode transaction proposal and formats the response
     * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
     * @param [args] - An array of string arguments or a buffer specific to the chaincode's 'Invoke' method
     * @param [opts] - The options for the query
     * @param {TransactionID} [opts.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {Map} [opts.transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
     * @param {Peer} [opts.target] - The peer to use for the transaction proposal, falls back to the first peer in the channel if unspecified
     * @param {number} [opts.timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns A promise containing formatted transactionProposal response from a single peer
     */
    query(
        fcn?: string,
        argsOrArgBytes?: Array<string> | Buffer,
        {
            txId,
            transientMap,
            target,
            timeout
        }: {
            txId?: TransactionID,
            transientMap?: Object,
            target?: Peer,
            timeout?: number
        } = {}
    ): Promise<QueryChaincodeResponse> {
        return this.userClient.queryChaincode(
            this.channel,
            addArgsOrArgBytesToRequest(
                {
                    txId,
                    chaincodeId: this.chaincodeId,
                    target,
                    fcn,
                    transientMap
                },
                argsOrArgBytes
            ),
            timeout
        )
    }

    /**
     * Performs a chaincode invoke
     * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
     * @param [args] - An array of string arguments or a buffer specific to the chaincode's 'Invoke' method
     * @param [opts] - The options for the invoke
     * @param {TransactionID} [opts.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {Map} [opts.transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
     * @param {Array<Peer>|Policy} [opts.targets] - The peers to use for the transaction proposal or endorsement policy for the chaincode, falls back to the peers in the channel if unspecified
     * @param {number} [opts.timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns A promise containing an object that contains information about the invoke
     */
    invoke(
        fcn?: string,
        argsOrArgBytes?: Array<string> | Buffer,
        {
            txId,
            transientMap,
            targets,
            timeout
        }: {
            txId?: TransactionID,
            transientMap?: Object,
            targets?: Array<Peer>,
            timeout?: number
        } = {}
    ): Promise<InvokeChaincodeResponse> {
        return this.userClient.invokeChaincode(
            this.channel,
            addArgsOrArgBytesToRequest(
                {
                    txId,
                    chaincodeId: this.chaincodeId,
                    targets: targets || this.endorsingPeers,
                    fcn,
                    transientMap
                },
                argsOrArgBytes
            ),
            timeout
        )
    }

    /**
     * Performs a chaincode transaction proposal
     * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
     * @param [argsOrArgBytes] - An array of string arguments or a buffer specific to the chaincode's 'Invoke' method
     * @param [opts] - The options for the transaction proposal
     * @param {TransactionID} [opts.txId] - TransactionID object with the transaction id and nonce. One will be generated automatically if not supplied
     * @param {Map} [opts.transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
     * @param {Array<Peer>|Policy} [opts.targets] - The peers to use for the transaction proposal or endorsement policy for the chaincode, falls back to the peers in the channel if unspecified
     * @param {number} [opts.timeout=60000] - A number indicating milliseconds to wait on the response before rejecting the promise with a timeout error.
     * @returns A promise containing a transactionProposal response from all the peers
     */
    sendTransactionProposal(
        fcn?: string,
        argsOrArgBytes?: Array<string> | Buffer,
        {
            txId,
            transientMap,
            targets,
            timeout
        }: {
            txId?: TransactionID,
            transientMap?: Object,
            targets?: Array<Peer>,
            timeout?: number
        } = {}
    ): Promise<SendTransactionProposalResponse> {
        return this.userClient.sendTransactionProposal(
            this.channel,
            addArgsOrArgBytesToRequest(
                {
                    txId,
                    chaincodeId: this.chaincodeId,
                    targets: targets || this.endorsingPeers,
                    fcn,
                    transientMap
                },
                argsOrArgBytes
            ),
            timeout
        )
    }

    /**
     * Performs a chaincode transaction
     * @param transactionId - The id of the transaction
     * @param transactionRequest - an object representing an transaction request
     * @returns A promise containing an object that contains information about the transaction
     */
    sendTransaction(
        transactionId: string,
        transactionRequest: TransactionRequest
    ): Promise<SendTransactionResponse> {
        return this.userClient.sendTransaction(
            this.channel,
            transactionId,
            transactionRequest
        )
    }

    /**
     * Registers a chaincode event listener on the channel. Note this is channel specific!
     * @param eventName - The name of the event to listen on
     * @param onEvent - Callback function for matched events. It gets passed a single parameter which is a ChaincodeEvent object
     * @param [onError] - Callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
     * @returns eventHubManager and handle
     */
    registerChaincodeEventListener(
        eventName: string,
        onEvent: Function,
        onError?: Function
    ): {
        eventHubManager: EventHubManager,
        handle: Object
    } {
        if (!isFcwChannel(this.channel)) {
            throw new Error(
                "Error Transactor.registerChaincodeEvent requires a FcwChannel"
            )
        }

        const eventHubPeers = this.channel
            .getPeers()
            .filter(peer => isEventHubPeer(peer))
        if (eventHubPeers.length === 0) {
            throw new Error(
                "Error Transactor.registerChaincodeEvent requires an EventHubPeer in channel"
            )
        }

        const eventHubManager = eventHubPeers[0].getEventHubManager()
        const handle = eventHubManager.registerChaincodeEvent(
            this.chaincodeId,
            eventName,
            event => {
                if (this.channel.getTransactionIdTimeMap().has(event.tx_id)) {
                    onEvent(event)
                }
            },
            onError
        )
        return { eventHubManager, handle }
    }
}
