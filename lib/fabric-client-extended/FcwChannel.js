// @flow
import type FabricClient from 'fabric-client'
import type Peer from 'fabric-client/lib/Peer'
import type Orderer from 'fabric-client/lib/Orderer'
import Channel from 'fabric-client/lib/Channel'
import type UserClient from '../UserClient'

export type FcwChannelOpts = {
    channelName: string,
    client?: FabricClient | UserClient,
    peers: Array<Peer>,
    orderer: Orderer,
}

/**
* A fabric-client Channel with a more flexible constructor
* @param opts - The options for creating the Channel
* @param {string} opts.channelName - The name of the channel
* @param {FabricClient|UserClient} [opts.client] - The client context to use for operations
* @param {Array<Peer>} [opts.peers] - An array of peers to use for channel operations
* @param {Orderer} opts.orderer - The orderer to use for the channel
*/
export default class FcwChannel extends Channel {
    constructor({ channelName, client, peers = [], orderer }: FcwChannelOpts) {
        if (!client) {
            super(channelName, {})
        } else if (client.client) {
            super(channelName, client.client)
        } else {
            super(channelName, client)
        }
        this.addOrderer(orderer)
        peers.forEach(peer => {
            this.addPeer(peer)
        })
    }
}
