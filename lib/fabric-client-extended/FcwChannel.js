// @flow
import type FabricClient from 'fabric-client'
import type Peer from 'fabric-client/lib/Peer'
import type Orderer from 'fabric-client/lib/Orderer'
import Channel from 'fabric-client/lib/Channel'
import type UserClient from '../UserClient'
import TransactionIdTimeMap from '../TransactionIdTimeMap'

export type FcwChannelOpts = {
    transactionTimeMapLifetime?: number,
}

export type CreateFcwChannelOpts = FcwChannelOpts & {
    channelName: string,
    client?: FabricClient | UserClient,
    peers: Array<Peer>,
    orderers: Array<Orderer>,
}

/**
 * A fabric-client Channel with a more flexible constructor that keeps track of transactionIds
 * @param opts - The options for creating the Channel
 * @param {string} opts.channelName - The name of the channel
 * @param {FabricClient|UserClient} [opts.client] - The client context to use for operations
 * @param {Array<Peer>} [opts.peers] - An array of peers to use for channel operations
 * @param {Orderer} opts.orderer - The orderer to use for the channel
 */

export function upgradeChannelToFcwChannel(channel: Channel, { transactionTimeMapLifetime }: FcwChannelOpts) {
    channel.transactionIdTimeMap = new TransactionIdTimeMap(transactionTimeMapLifetime)

    /**
     * Gets the TransactionIdTimeMap instance
     */
    channel.getTransactionIdTimeMap = () => channel.transactionIdTimeMap
    return channel
}

export function createFcwChannel({
    channelName,
    client,
    peers = [],
    orderers = [],
    transactionTimeMapLifetime,
}: CreateFcwChannelOpts) {
    let channelClient
    if (!client) {
        channelClient = {}
    } else if (client.client) {
        channelClient = client.client
    } else {
        channelClient = client
    }
    const channel = new Channel(channelName, channelClient)
    orderers.forEach(orderer => {
        channel.addOrderer(orderer)
    })
    peers.forEach(peer => {
        channel.addPeer(peer)
    })
    return upgradeChannelToFcwChannel(channel, { transactionTimeMapLifetime })
}

export function isFcwChannel(obj: any) {
    return obj.getPeers && obj.getTransactionIdTimeMap
}
