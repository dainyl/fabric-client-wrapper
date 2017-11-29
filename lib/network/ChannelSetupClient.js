// @flow
import net from "net"
import { DEFAULT_PORT, SPLIT_CHAR } from "./ChannelSetupServer"

export type DistributedSetupChannelClientOpts = {
    mspIds: Array<string>,
    host: string,
    port?: number,
    onError?: Function
}

// TODO change type to net.Socket once flow recognises socket.connect options correctly
function makeConnection(socket: any, port: ?number, host: string) {
    socket.connect(port || DEFAULT_PORT, host)
}

export default class ChannelSetupClient {
    mspIdMessage: string
    socket: net.Socket
    gotRequest: boolean
    gotDone: boolean
    waitRequestCbs: Array<Function>
    waitDoneCbs: Array<Function>

    constructor({
        mspIds,
        host,
        port,
        onError
    }: DistributedSetupChannelClientOpts) {
        this.mspIdMessage = mspIds.join(SPLIT_CHAR)
        this.gotRequest = false
        this.gotDone = false
        this.waitRequestCbs = []
        this.waitDoneCbs = []
        this.socket = new net.Socket()

        this.socket.on("data", data => {
            const message = data.toString()
            if (message === "request") {
                this.gotRequest = true
                this.waitRequestCbs.forEach(cb => cb())
                this.waitRequestCbs = []
            } else if (message === "done") {
                this.gotDone = true
                this.waitDoneCbs.forEach(cb => cb())
                this.waitDoneCbs = []
            }
        })
        if (onError) {
            this.socket.on("error", onError)
        }
        makeConnection(this.socket, port, host)
    }

    waitRequest(timeout: number = 60000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.gotRequest) {
                return resolve()
            }
            const handle = setTimeout(
                () =>
                    reject(
                        new Error("Error: Timeout waiting for server request")
                    ),
                timeout
            )
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            this.waitRequestCbs.push(cb)
            return null
        })
    }

    waitDone(timeout: number = 60000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.gotDone) {
                return resolve()
            }
            const handle = setTimeout(
                () =>
                    reject(
                        new Error(
                            "Error: Timeout waiting for server to complete"
                        )
                    ),
                timeout
            )
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            this.waitDoneCbs.push(cb)
            return null
        })
    }

    sendReady() {
        this.socket.write(this.mspIdMessage)
    }

    destroy() {
        this.socket.destroy()
    }
}
