// @flow
import type EventHub from 'fabric-client/lib/EventHub'
import wait from './wait'

export default class EventHubManager {
    eventHub: EventHub
    blockEventHandles: Map<number, boolean>
    chaincodeEventHandles: Map<number, boolean>
    txEventHandles: Map<number, boolean>

    constructor(eventHub: EventHub) {
        this.eventHub = eventHub
        this.blockEventHandles = new Map()
        this.chaincodeEventHandles = new Map()
        this.txEventHandles = new Map()
    }

    getEventHubManager() {
        return this.eventHub
    }

    async registerEvent(
        onEvent: Function,
        onError: Function,
        registerFunction: Function,
        handleMap: Map<number, boolean>
    ) {
        const handle = registerFunction.call(this.eventHub, onEvent, onError)
        handleMap.set(handle, true)
        if (!this.eventHub.isconnected()) {
            this.eventHub.connect()
            await this.waitEventHubConnected()
        }
        return handle
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

    registerBlockEvent(onEvent: Function, onError: Function) {
        return this.registerEvent(
            onEvent,
            onError,
            this.eventHub.registerBlockEvent,
            this.blockEventHandles
        ).catch(error => {
            console.error('error', error)
        })
    }

    registerChaincodeEvent(onEvent: Function, onError: Function) {
        return this.registerEvent(onEvent, onError, this.eventHub.registerChaincodeEvent, this.chaincodeEventHandles)
    }

    async registerTxEvent(onEvent: Function, onError: Function) {
        return this.registerEvent(onEvent, onError, this.eventHub.registerTxEvent, this.txEventHandles)
    }

    async unregisterEvent(handle: number, unregisterFunction: Function, handleMap: Map<number, boolean>) {
        const unregisterResult = unregisterFunction.call(this.eventHub, handle)
        handleMap.delete(handle)
        if (handleMap.size === 0) {
            this.eventHub.disconnect()
        }
        return unregisterResult
    }

    unregisterBlockEvent(handle: number) {
        return this.unregisterEvent(handle, this.eventHub.unregisterBlockEvent, this.blockEventHandles)
    }

    unregisterChaincodeEvent(handle: number) {
        return this.unregisterEvent(handle, this.eventHub.unregisterChaincodeEvent, this.chaincodeEventHandles)
    }

    unregisterTxEvent(handle: number) {
        return this.unregisterEvent(handle, this.eventHub.unregisterTxEvent, this.txEventHandles)
    }
}
