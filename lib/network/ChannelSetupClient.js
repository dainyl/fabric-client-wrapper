// @flow
import net from "net"
import {
    createClientReadyMessage,
    createClientDoneMessage,
    extract,
    TYPES,
    DEFAULT_PORT
} from "./util"

export type DistributedSetupChannelClientOpts = {
    host: string,
    port?: number,
    onError?: Function
}

// TODO change type to net.Socket once flow recognises socket.connect options correctly
function makeConnection(socket: any, port: ?number, host: string) {
    socket.connect(port || DEFAULT_PORT, host)
}

export type AddChannelOpts = {
    channelName: string,
    mspIds: Array<string>
}

export type ClientMeta = {
    mspIds: Array<string>,
    gotServerReady: boolean,
    gotClientInit: boolean,
    gotServerDone: boolean,
    waitServerReadyCbs: Array<Function>,
    waitClientInitCbs: Array<Function>,
    waitServerDoneCbs: Array<Function>
}

export default class ChannelSetupClient {
    socket: net.Socket
    metas: Map<string, ClientMeta>

    constructor({ host, port, onError }: DistributedSetupChannelClientOpts) {
        this.socket = new net.Socket()
        this.metas = new Map()

        this.socket.on("data", data => {
            extract(data.toString()).forEach(({ channelName, type }) => {
                const meta = this.metas.get(channelName)
                if (meta) {
                    if (type === TYPES.SERVER_READY) {
                        meta.gotServerReady = true
                        meta.waitServerReadyCbs.forEach(cb => cb())
                        meta.waitServerReadyCbs = []
                    } else if (type === TYPES.CLIENT_INIT) {
                        meta.gotClientInit = true
                        meta.waitClientInitCbs.forEach(cb => cb())
                        meta.waitClientInitCbs = []
                    } else if (type === TYPES.SERVER_DONE) {
                        meta.gotServerDone = true
                        meta.waitServerDoneCbs.forEach(cb => cb())
                        meta.waitServerDoneCbs = []
                    }
                }
            })
        })

        if (onError) {
            this.socket.on("error", onError)
        }

        makeConnection(this.socket, port, host)
    }

    addChannel({ channelName, mspIds }: AddChannelOpts) {
        const meta = {
            mspIds,
            gotServerReady: false,
            gotClientInit: false,
            gotServerDone: false,
            waitServerReadyCbs: [],
            waitClientInitCbs: [],
            waitServerDoneCbs: []
        }
        this.metas.set(channelName, meta)
        this.socket.write(createClientReadyMessage(channelName))
    }

    waitServerReady(
        channelName: string,
        timeout: number = 600000
    ): Promise<void> {
        const meta = this.metas.get(channelName)
        if (!meta) {
            throw new Error(
                `Error: Attempted to wait on unknown channel ${
                    channelName
                } please call addChannel first`
            )
        }
        return new Promise((resolve, reject) => {
            if (meta.gotServerReady) {
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
            meta.waitServerReadyCbs.push(cb)
            return null
        })
    }

    waitClientInitRequest(
        channelName: string,
        timeout: number = 600000
    ): Promise<void> {
        const meta = this.metas.get(channelName)
        if (!meta) {
            throw new Error(
                `Error: Attempted to wait on unknown channel ${
                    channelName
                } please call addChannel first`
            )
        }
        return new Promise((resolve, reject) => {
            if (meta.gotClientInit) {
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
            meta.waitClientInitCbs.push(cb)
            return null
        })
    }

    waitServerDone(
        channelName: string,
        timeout: number = 600000
    ): Promise<void> {
        const meta = this.metas.get(channelName)
        if (!meta) {
            throw new Error(
                `Error: Attempted to wait on unknown channel ${
                    channelName
                } please call addChannel first`
            )
        }
        return new Promise((resolve, reject) => {
            if (meta.gotServerDone) {
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
            meta.waitServerDoneCbs.push(cb)
            return null
        })
    }

    sendClientDone(channelName: string) {
        const meta = this.metas.get(channelName)
        if (!meta) {
            throw new Error(
                `Error: Attempted to send CLIENT_DONE on unknown channel ${
                    channelName
                } please call addChannel first`
            )
        }
        this.socket.write(createClientDoneMessage(channelName, meta.mspIds))
    }

    destroy() {
        this.socket.destroy()
    }
}
