// @flow
import net from 'net'
import { DEFAULT_PORT, SPLIT_CHAR } from './DistributedSetupChannelServer'

export type DistributedSetupChannelClientOpts = {
    mspIds: Array<string>,
    host: string,
    port?: number,
}

export default class DistributedSetupChannelClient {
    mspIdMessage: string
    socket: net.Socket
    completed: boolean
    waitRequestCbs: Array<Function>
    waitCompletedCbs: Array<Function>

    constructor({ mspIds, host, port }: DistributedSetupChannelClientOpts) {
        this.mspIdMessage = mspIds.join(SPLIT_CHAR)
        this.completed = false
        this.socket = net.connect(port || DEFAULT_PORT, host)
        this.waitRequestCbs = []
        this.waitCompletedCbs = []
        this.socket.on('data', data => {
            const message = data.toString()
            if (message === 'request') {
                this.waitRequestCbs.forEach(cb => cb())
                this.waitRequestCbs = []
            } else if (message === 'complete') {
                this.completed = true
                this.waitCompletedCbs.forEach(cb => cb())
                this.waitCompletedCbs = []
            }
        })
    }

    waitRequest(timeout: number = 60000) {
        return new Promise((resolve, reject) => {
            if (!this.socket.connecting) {
                return resolve()
            }
            const handle = setTimeout(() => reject(new Error('Error: Timeout waiting for server request')), timeout)
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            this.waitRequestCbs.push(cb)
            return null
        })
    }

    waitCompleted(timeout: number = 60000) {
        return new Promise((resolve, reject) => {
            if (this.completed) {
                return resolve()
            }
            const handle = setTimeout(() => reject(new Error('Error: Timeout connecting to server')), timeout)
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            this.waitCompletedCbs.push(cb)
            return null
        })
    }

    sendDone() {
        this.socket.write(this.mspIdMessage)
    }
}
