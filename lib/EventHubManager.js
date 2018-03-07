// @flow
import type EventHub from "fabric-client/lib/EventHub"
import wait from "./wait"

function fallBackErrorHandler(error) {
    console.error("EventHub Error", error)
}

/**
 * A class that manages an EventHub and when it is connected
 * @param eventHub - The EventHub to manage
 */
export default class EventHubManager {
    eventHub: EventHub
    errorCatcherHandle: ?Object
    listenerCount: number

    constructor(eventHub: EventHub) {
        this.eventHub = eventHub
        this.listenerCount = 0
    }

    connect(onError?: Function) {
        if (!this.eventHub.isconnected()) {
            this.errorCatcherHandle = this.eventHub.registerBlockEvent(() => {},
            onError || fallBackErrorHandler)
            this.eventHub.connect()
        }
    }

    // TODO document
    addNumListeners(numNewListeners: number, onError?: Function) {
        if (this.listenerCount === 0) {
            this.connect()
        }
        this.listenerCount += numNewListeners
    }

    // TODO document
    incrementListenerCount(onError?: Function) {
        this.addNumListeners(1, onError)
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
        throw new Error("Error timed out while waiting for eventhub")
    }

    /**
     * Checks whether the eventHubManager can currently connect
     * @typedef canConnect
     * @memberof EventHubChannel#
     * @returns {Promise<boolean>} true if the channel can connect, false otherwise
     */
    canConnect(timeout: number = 60000): Promise<boolean> {
        return new Promise(resolve => {
            let blockRegistrationNumber
            const handle = setTimeout(() => {
                this.unregisterBlockEvent(blockRegistrationNumber)
                resolve(false)
            }, timeout)
            this.incrementListenerCount()
            blockRegistrationNumber = this.registerBlockEvent(
                () => {},
                () => {
                    clearTimeout(handle)
                    this.unregisterBlockEvent(blockRegistrationNumber)
                    resolve(false)
                }
            )
            this.waitEventHubConnected(timeout)
                .then(() => {
                    clearTimeout(handle)
                    this.unregisterBlockEvent(blockRegistrationNumber)
                    resolve(true)
                })
                .catch(() => {
                    clearTimeout(handle)
                    this.unregisterBlockEvent(blockRegistrationNumber)
                    resolve(false)
                })
        })
    }

    /**
     * Connects Eventhub if it is not connected and registers a listener to receive all block events from all the channels that the target peer is part of. The listener's "onEvent" callback gets called on the arrival of every block. If the target peer is expected to participate in more than one channel, then care must be taken in the listener's implementation to differentiate blocks from different channels. See the example below on how to accomplish that. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
     * @param onEvent - Callback function that takes a single parameter of a Block object
     * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
     */
    registerBlockEvent(onEvent: Function, onError?: Function): number {
        return this.eventHub.registerBlockEvent(
            onEvent,
            onError || fallBackErrorHandler
        )
    }

    /**
     * Connects Eventhub if it is not connected and registers a listener to receive chaincode events. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
     * @param ccId - Id of the chaincode of interest
     * @param eventName - The exact name of the chaincode event (must match the name given to the target chaincode's call to stub.SetEvent(name, payload)), or a regex string to match more than one event by this chaincode
     * @param onEvent - Callback function for matched events. It gets passed a single parameter which is a ChaincodeEvent object
     * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
     */
    registerChaincodeEvent(
        ccId: string,
        eventName: string,
        onEvent: Function,
        onError?: Function
    ): Object {
        return this.eventHub.registerChaincodeEvent(
            ccId,
            eventName,
            onEvent,
            onError || fallBackErrorHandler
        )
    }

    /**
     * Connects Eventhub if it is not connected and register a callback function to receive a notification when the transaction by the given id has been committed into a block. An error may be thrown by this call if no "onError" callback is provided and this EventHub has noticed that the connection has not been established. However since the connection establishment is running asynchronously, a register call could be made before this EventHub has been notified of the network issue. The best practice would be to provide an "onError" callback to be notified when this EventHub has an issue.
     * @param txId - Transaction id string
     * @param onEvent - Callback function that takes a parameter of type Transaction, and a string parameter which indicates if the transaction is valid (code = 'VALID'), or not (code string indicating the reason for invalid transaction)
     * @param [onError] - Optional callback function to be notified when this event hub is shutdown. The shutdown may be caused by a network error or by a call to the "disconnect()" method or a connection error.
     */
    registerTxEvent(
        txId: string,
        onEvent: Function,
        onError?: Function
    ): string {
        this.eventHub.registerTxEvent(
            txId,
            onEvent,
            onError || fallBackErrorHandler
        )
        return txId
    }

    /**
     * Disconnects EventHub if it is not being used
     * @ignore
     */
    disconnectEventHubIfUnused() {
        if (this.listenerCount < 0) {
            throw new Error("Error number of event listeners less than 0")
        }
        if (this.listenerCount === 0) {
            this.eventHub.unregisterBlockEvent(this.errorCatcherHandle)
            this.eventHub.disconnect()
        }
    }

    /**
     * Unregister the block event listener using the block registration number that is returned by the call to the registerBlockEvent() method. If there are no more listeners, it disconnects the EventHub
     * @param handle - block registration number that was returned during registration.
     */
    unregisterBlockEvent(handle: number) {
        const unregisterResult = this.eventHub.unregisterBlockEvent(handle)
        this.disconnectEventHubIfUnused()
        return unregisterResult
    }

    /**
     * Unregister the chaincode event listener represented by the listener_handle object returned by the registerChaincodeEvent() method. If there are no more listeners, it disconnects the EventHub
     * @param handle - The handle object returned from the call to registerChaincodeEvent.
     */
    unregisterChaincodeEvent(handle: Object) {
        const unregisterResult = this.eventHub.unregisterChaincodeEvent(handle)
        this.disconnectEventHubIfUnused()
        return unregisterResult
    }

    /**
     * Unregister transaction event listener for the transaction id. If there are no more listeners, it disconnects the EventHub
     * @param txId - The transaction ID
     */
    unregisterTxEvent(txId: string) {
        const unregisterResult = this.eventHub.unregisterTxEvent(txId)
        this.disconnectEventHubIfUnused()
        return unregisterResult
    }
}
