// @flow
import net from 'net'
import { DEFAULT_PORT, SPLIT_CHAR } from './ChannelSetupServer'

export type DistributedSetupChannelClientOpts = {
    mspIds: Array<string>,
    host: string,
    port?: number,
    onError?: Function,
}

// TODO change type to net.Socket once flow recognises socket.connect options correctly
function makeConnection(socket: any, port: ?number, host: string) {
    socket.connect(port || DEFAULT_PORT, host)
}

export default class ChannelSetupClient {
    mspIdMessage: string
    socket: net.Socket
    completed: boolean
    waitRequestCbs: Array<Function>
    waitCompletedCbs: Array<Function>

    constructor({ mspIds, host, port, onError }: DistributedSetupChannelClientOpts) {
        this.mspIdMessage = mspIds.join(SPLIT_CHAR)
        this.completed = false
        this.waitRequestCbs = []
        this.waitCompletedCbs = []
        this.socket = new net.Socket()

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
        if (onError) {
            this.socket.on('error', onError)
        }
        makeConnection(this.socket, port, host)
    }

    waitRequest(timeout: number = 60000): Promise<void> {
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

    waitCompleted(timeout: number = 60000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.completed) {
                return resolve()
            }
            const handle = setTimeout(() => reject(new Error('Error: Timeout waiting for server to complete')), timeout)
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
