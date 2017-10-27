// @flow
import type EventHub from 'fabric-client/lib/EventHub'
import wait from './wait'

function fallBackErrorHandler(error) {
    console.error('error', error)
}

/**
* A class that manages an EventHub and when it is connected
* @param eventHub - The EventHub to manage
*/
export default class EventHubManager {
    eventHub: EventHub
    blockEventMap: Map<number, boolean>
    chaincodeEventMap: Map<string, number>
    txEventMap: Map<string, number>

    constructor(eventHub: EventHub) {
        this.eventHub = eventHub
        this.blockEventMap = new Map()
        this.chaincodeEventMap = new Map()
        this.txEventMap = new Map()
    }

    /**
    * Gets the underlying EventHub
    */
    getEventHubManager(): EventHub {
        return this.eventHub
    }

    /**
    * Waits until the EventHub has been connected
    * @param [timeout=60000] - The maximum amount of time to wait for the EventHub to connect
    */
    async waitEventHubConnected(timeout: number = 60000): Promise<boolean> {
        let endDate = new Date()
        endDate = new Date(endDate.getTime() + timeout)
        while (new Date() < endDate) {
            if (this.eventHub.isconnected()) {
                return true
            }
            await wait(100) // eslint-disable-line no-await-in-loop
        }
        throw new Error('Error timed out while waiting for eventhub')
    }

    /**
    * Connects Eventhub if it is not connected and registers a listener to receive all block events from all the channels that the target peer is part of. The listener's "onEvent" callback gets called on the arrival of every block. If the target peer is expected to participate in more than one channel, then care must be taken in the listener's implementation to differentiate blocks from different channels. See the example below on how to accomplish that. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
    * @param onEvent - Callback function that takes a single parameter of a Block object
    * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
    */
    registerBlockEvent(onEvent: Function, onError?: Function): number {
        const handle = this.eventHub.registerBlockEvent(onEvent, onError || fallBackErrorHandler)
        this.blockEventMap.set(handle, true)
        if (!this.eventHub.isconnected()) {
            this.eventHub.connect()
        }
        return handle
    }

    /**
    * Connects Eventhub if it is not connected and registers a listener to receive chaincode events. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
    * @param ccId - Id of the chaincode of interest
    * @param eventName - The exact name of the chaincode event (must match the name given to the target chaincode's call to stub.SetEvent(name, payload)), or a regex string to match more than one event by this chaincode
    * @param onEvent - Callback function for matched events. It gets passed a single parameter which is a ChaincodeEvent object
    * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
    */
    registerChaincodeEvent(ccId: string, eventName: string, onEvent: Function, onError?: Function): Object {
        const handle = this.eventHub.registerChaincodeEvent(ccId, eventName, onEvent, onError || fallBackErrorHandler)
        const currNumber = this.chaincodeEventMap.get(ccId)
        if (typeof currNumber === 'undefined') {
            this.chaincodeEventMap.set(ccId, 1)
        } else {
            this.chaincodeEventMap.set(ccId, currNumber + 1)
        }
        if (!this.eventHub.isconnected()) {
            this.eventHub.connect()
        }
        return handle
    }

    /**
    * Connects Eventhub if it is not connected and register a callback function to receive a notification when the transaction by the given id has been committed into a block. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
    * @param txId - Transaction id string
    * @param onEvent - Callback function that takes a parameter of type Transaction, and a string parameter which indicates if the transaction is valid (code = 'VALID'), or not (code string indicating the reason for invalid transaction)
    * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
    */
    registerTxEvent(txId: string, onEvent: Function, onError?: Function): string {
        this.eventHub.registerTxEvent(txId, onEvent, onError || fallBackErrorHandler)
        const currNumber = this.txEventMap.get(txId)
        if (typeof currNumber === 'undefined') {
            this.txEventMap.set(txId, 1)
        } else {
            this.txEventMap.set(txId, currNumber + 1)
        }
        if (!this.eventHub.isconnected()) {
            this.eventHub.connect()
        }
        return txId
    }

    /**
    * Disconnects EventHub if it is not being used
    * @ignore
    */
    disconnectEventHubIfUnused() {
        if (this.blockEventMap.size === 0 && this.chaincodeEventMap.size === 0 && this.txEventMap.size === 0) {
            this.eventHub.disconnect()
        }
    }

    /**
    * Unregister the block event listener using the block registration number that is returned by the call to the registerBlockEvent() method. If there are no more listeners, it disconnects the EventHub
    * @param handle - block registration number that was returned during registration.
    */
    unregisterBlockEvent(handle: number) {
        const unregisterResult = this.eventHub.unregisterBlockEvent(handle)
        this.blockEventMap.delete(handle)
        this.disconnectEventHubIfUnused()
        return unregisterResult
    }

    /**
    * Unregister the chaincode event listener represented by the listener_handle object returned by the registerChaincodeEvent() method. If there are no more listeners, it disconnects the EventHub
    * @param handle - The handle object returned from the call to registerChaincodeEvent.
    */
    unregisterChaincodeEvent(handle: Object) {
        const unregisterResult = this.eventHub.unregisterChaincodeEvent(handle)
        const ccId = handle.ccid
        const currNumber = this.chaincodeEventMap.get(ccId)

        if (typeof currNumber === 'undefined') {
            throw new Error(`No listener registerd for ${ccId}`)
        } else if (currNumber > 1) {
            this.chaincodeEventMap.set(ccId, currNumber - 1)
        } else {
            this.chaincodeEventMap.delete(ccId)
        }

        this.disconnectEventHubIfUnused()

        return unregisterResult
    }

    /**
    * Unregister transaction event listener for the transaction id. If there are no more listeners, it disconnects the EventHub
    * @param txId - The transaction ID
    */
    unregisterTxEvent(txId: string) {
        const unregisterResult = this.eventHub.unregisterTxEvent(txId)
        const currNumber = this.txEventMap.get(txId)

        if (typeof currNumber === 'undefined') {
            throw new Error(`No listener registerd for ${txId}`)
        } else if (currNumber > 1) {
            this.txEventMap.set(txId, currNumber - 1)
        } else {
            this.txEventMap.delete(txId)
        }

        this.disconnectEventHubIfUnused()

        return unregisterResult
    }
}
