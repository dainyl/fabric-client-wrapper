// @flow

import net from "net"
import _ from "lodash/fp"
import type Channel from "fabric-client/lib/Channel"
import type UserClient from "../UserClient"
import {
    createClientInitMessage,
    createServerReadyMessage,
    createServerDoneMessage,
    extract,
    TYPES,
    DEFAULT_PORT
} from "./util"

export type DistributedSetupChannelServerOpts = {
    channelName?: string,
    userClient?: UserClient,
    channel?: Channel,
    externalMspIds?: Array<string>,
    port?: number,
    onError?: Function
}

export type ConnectChannelOpts = {
    channelName?: string,
    userClient?: UserClient,
    channel?: Channel,
    externalMspIds?: Array<string>
}

export type ServerChannelMeta = {
    externalMspIds: Array<string>,
    mspResponses: Array<string>,
    clientInitCbs: Array<Function>,
    isRequestClientInit: boolean
}

export default class ChannelSetupServer {
    clients: Array<net.Socket>
    server: net.Server
    metas: Map<string, ServerChannelMeta>

    constructor({ onError, port }: DistributedSetupChannelServerOpts) {
        this.metas = new Map()
        this.clients = []
        this.server = net.createServer(socket => {
            socket.channels = []
            this.clients.push(socket)
            this.metas.forEach((meta, channelName) => {
                if (meta.isRequestClientInit) {
                    socket.write(createClientInitMessage(channelName))
                }
            })

            socket.on("data", data => {
                extract(data.toString()).forEach(
                    ({ channelName, type, body }) => {
                        if (type === TYPES.CLIENT_READY) {
                            socket.channels.push(channelName)
                            if (this.metas.has(channelName)) {
                                socket.write(
                                    createServerReadyMessage(channelName)
                                )
                            }
                        } else if (type === TYPES.CLIENT_DONE) {
                            const meta = this.metas.get(channelName)
                            if (!meta) {
                                throw new Error(
                                    `Error server recieved request for unknown channel: ${
                                        channelName
                                    }`
                                )
                            }

                            meta.mspResponses = _.compose(
                                _.intersection(meta.externalMspIds),
                                _.uniq
                            )(meta.mspResponses.concat(body))

                            if (
                                meta.mspResponses.length ===
                                meta.externalMspIds.length
                            ) {
                                meta.clientInitCbs.forEach(cb => cb())
                                meta.mspResponses = []
                                meta.isRequestClientInit = false
                                meta.clientInitCbs = []
                            }
                        }
                    }
                )
            })

            socket.on("end", () => {
                this.clients.splice(this.clients.indexOf(socket), 1)
            })
        })

        if (onError) {
            this.server.on("error", onError)
        }

        this.server.listen(port || DEFAULT_PORT)
    }

    connectChannel({
        userClient,
        channel,
        channelName,
        externalMspIds
    }: ConnectChannelOpts) {
        const meta = {
            externalMspIds: [],
            mspResponses: [],
            clientInitCbs: [],
            isRequestClientInit: false
        }
        if (externalMspIds) {
            meta.externalMspIds = externalMspIds
        } else if (userClient && channel) {
            const userMspId = userClient.getMspId()
            const externalPeers = channel
                .getPeers()
                .filter(peer => !peer.getAdminMspIds().includes(userMspId))
            meta.externalMspIds = _.uniq(
                externalPeers.map(peer => peer.getMspId())
            )
        } else {
            throw new Error(
                "Error: either externalMspIds or userClient and channel are required"
            )
        }

        if (!channel && !channelName) {
            throw new Error("Error: channelName or channel is required")
        }

        const myChannelName: string = channelName || (channel: any).getName()

        this.metas.set(myChannelName, meta)

        this.clients
            .filter((client: any) => client.channels.includes(myChannelName))
            .forEach(socket => {
                socket.write(createServerReadyMessage(myChannelName))
            })
    }

    requestClientInit(
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
            const handle = setTimeout(
                () => reject(new Error("Error: Timeout waiting for clients")),
                timeout
            )
            meta.isRequestClientInit = true
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            meta.clientInitCbs.push(cb)
            this.clients.forEach(socket => {
                socket.write(createClientInitMessage(channelName))
            })
        })
    }

    done(channelName: string) {
        this.clients
            .filter((client: any) => client.channels.includes(channelName))
            .forEach(socket => {
                socket.write(createServerDoneMessage(channelName))
            })
    }

    close() {
        this.server.close()
    }
}
