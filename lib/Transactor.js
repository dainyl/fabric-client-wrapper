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
import type { TransactionRequest, Policy } from './FABRIC_FLOW_TYPES'
import type UserClient from './UserClient'
import type EventHubManager from './EventHubManager'
import { isFcwChannel, isEventHubPeer } from './fabric-client-extended'
import pickPeersForPolicy from './pickPeersForPolicy'

/** Class for issuing chaincode transactions */
export default class Transactor {
    userClient: UserClient
    channel: Channel
    chaincodeId: string
    endorsingPeers: Array<Peer> | void

    /**
    * Creates a new object for issuing chaincode transactions or listening for chaincode events
    * @param userClient - The UserClient representing the user performing chaincode transactions
    * @param channel - The Channel object representing the channel to transact on
    * @param chaincodeId - The ID of the chaincode being transacted on
    * @param [peersOrPolicy] - An array of peers to transact with or the endorsement policy to select peers with
    */
    constructor(userClient: UserClient, channel: Channel, chaincodeId: string, peersOrPolicy?: Array<Peer> | Policy) {
        this.userClient = userClient
        this.channel = channel
        this.chaincodeId = chaincodeId
        if (peersOrPolicy) {
            if (Array.isArray(peersOrPolicy)) {
                this.endorsingPeers = peersOrPolicy
            } else {
                this.endorsingPeers = pickPeersForPolicy(channel.getPeers(), peersOrPolicy)
            }
        }
    }

    /**
    * Performs a chaincode transaction proposal and formats the response
    * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
    * @param [args] - An array of string arguments specific to the chaincode's 'Invoke' method
    * @param {Map} [transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
    * @returns {Promise.<ChaincodeQueryResponse>} A promise containing formatted transactionProposal response from a single peer
    */
    query(fcn?: string, args?: Array<string>, transientMap?: Object) {
        return this.userClient.queryChaincode(this.channel, this.chaincodeId, this.endorsingPeers, {
            fcn,
            args,
            transientMap,
        })
    }

    /**
    * Performs a chaincode invoke
    * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
    * @param [args] - An array of string arguments specific to the chaincode's 'Invoke' method
    * @param {Map} [transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
    * @param [sendTransactionTimeout] - The maximum amount of time in ms to wait for a transaction
    * @returns {Promise.<ChaincodeInvokeResponse>} A promise containing an object that contains information about the invoke
    */
    invoke(fcn?: string, args?: Array<string>, transientMap?: Object, sendTransactionTimeout?: number) {
        return this.userClient.invokeChaincode(
            this.channel,
            this.chaincodeId,
            this.endorsingPeers,
            {
                fcn,
                args,
                transientMap,
            },
            sendTransactionTimeout
        )
    }

    /**
    * Performs a chaincode transaction proposal
    * @param [fcn] - The function name to be returned when calling `stub.GetFunctionAndParameters()` in the target chaincode. Default is 'invoke'
    * @param [args] - An array of string arguments specific to the chaincode's 'Invoke' method
    * @param {Map} [transientMap] - Map that can be used by the chaincode but not saved in the ledger, such as cryptographic information for encryption
    * @returns {Promise.<TransactionProposalResponse>} A promise containing a transactionProposal response from all the peers
    */
    sendTransactionProposal(fcn?: string, args?: Array<string>, transientMap?: Object) {
        return this.userClient.sendTransactionProposal(this.channel, this.chaincodeId, this.endorsingPeers, {
            fcn,
            args,
            transientMap,
        })
    }

    /**
    * Performs a chaincode transaction
    * @param transactionId - The id of the transaction
    * @param transactionRequest - an object representing an transaction request
    * @param [timeout] - The maximum amount of time in ms to wait for a peer to execute the transaction
    * @returns {Promise.<TransactionResponse>} A promise containing an object that contains information about the transaction
    */
    sendTransaction(transactionId: string, transactionRequest: TransactionRequest, timeout?: number) {
        return this.userClient.sendTransaction(this.channel, transactionId, transactionRequest, timeout)
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
        handle: Object,
    } {
        if (!isFcwChannel(this.channel)) {
            throw new Error('Error Transactor.registerChaincodeEvent requires a FcwChannel')
        }

        const eventHubPeers = this.channel.getPeers().filter(peer => isEventHubPeer(peer))
        if (eventHubPeers.length === 0) {
            throw new Error('Error Transactor.registerChaincodeEvent requires an EventHubPeer in channel')
        }

        const eventHubManager = eventHubPeers[0].getEventHubManager()
        const handle = eventHubManager.registerChaincodeEvent(
            this.chaincodeId,
            eventName,
            event => {
                if (this.channel.getTransactionIdTimeMap().has(event.tx_id)) {
                    onEvent({
                        transactionId: event.tx_id,
                        payload: event.payload.toString(),
                    })
                }
            },
            onError
        )
        return { eventHubManager, handle }
    }
}
