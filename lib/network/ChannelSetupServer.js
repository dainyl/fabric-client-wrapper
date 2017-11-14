// @flow

import net from 'net'
import _ from 'lodash/fp'
import type Channel from 'fabric-client/lib/Channel'
import type UserClient from '../UserClient'

export type DistributedSetupChannelServerOpts = {
    userClient?: UserClient,
    channel?: Channel,
    externalMspIds?: Array<string>,
    port?: number,
    onError?: Function,
}

export const DEFAULT_PORT = 45207
export const SPLIT_CHAR = '-'

export default class ChannelSetupServer {
    clients: Array<net.Socket>
    externalMspIds: Array<string>
    mspResponses: Array<string>
    waitResponsesCbs: Array<Function>
    requesting: boolean

    constructor({ userClient, channel, externalMspIds, port, onError }: DistributedSetupChannelServerOpts) {
        if (externalMspIds) {
            this.externalMspIds = externalMspIds
        } else if (userClient && channel) {
            const userMspId = userClient.getMspId()
            const externalPeers = channel.getPeers().filter(peer => !peer.getAdminMspIds().includes(userMspId))
            this.externalMspIds = _.uniq(externalPeers.map(peer => peer.getMspId()))
        } else {
            throw new Error('Error: either externalMspIds or userClient and channel are required')
        }

        this.clients = []
        this.mspResponses = []
        this.waitResponsesCbs = []
        this.requesting = false
        const server = net.createServer(socket => {
            this.clients.push(socket)
            if (this.requesting) {
                socket.write('request')
            }

            socket.on('data', data => {
                const message = data.toString()
                this.mspResponses = _.compose(_.intersection(this.externalMspIds), _.uniq)(
                    this.mspResponses.concat(message.split(SPLIT_CHAR))
                )
                if (this.mspResponses.length === this.externalMspIds.length) {
                    this.waitResponsesCbs.forEach(cb => {
                        cb()
                    })
                    this.mspResponses = []
                    this.requesting = false
                }
            })

            socket.on('end', () => {
                this.clients.splice(this.clients.indexOf(socket), 1)
            })
        })

        if (onError) {
            server.on('error', onError)
        }

        server.listen(port || DEFAULT_PORT)
    }

    requestResponses(timeout: number = 60000) {
        return new Promise((resolve, reject) => {
            const handle = setTimeout(() => reject(new Error('Error: Timeout waiting for clients')), timeout)
            this.requesting = true
            const cb = () => {
                clearTimeout(handle)
                resolve()
            }
            this.waitResponsesCbs.push(cb)
            this.clients.forEach(socket => {
                socket.write('request')
            })
        })
    }

    sendCompleted() {
        this.clients.forEach(socket => {
            socket.write('complete')
        })
    }
}
