// @flow
import type FabricClient from "fabric-client"
import type Peer from "fabric-client/lib/Peer"
import type Orderer from "fabric-client/lib/Orderer"
import Channel from "fabric-client/lib/Channel"
import type UserClient from "../UserClient"
import TransactionIdTimeMap from "../TransactionIdTimeMap"

export type FcwChannelOpts = {
    transactionTimeMapLifetime?: number
}

/**
 * Options to create a FcwChannel
 * @typedef {Object} NewFcwChannelOpts
 * @property {string} channelName - The name of the channel
 * @property {FabricClient|UserClient} [client] - The client context to use for operations
 * @property {Array<Peer>} [peers] - An array of peers to use for channel operations
 * @property {Array<Orderer>} orderers - The orderers to use for the channel
 * @property {string} transactionTimeMapLifetime - The amount of time to remember past transaction IDs
 */
export type NewFcwChannelOpts = FcwChannelOpts & {
    channelName: string,
    client?: FabricClient | UserClient,
    peers: Array<Peer>,
    orderers: Array<Orderer>
}

/**
 * A fabric-client Channel that keeps track of transactionIds
 * @typedef {Object} FcwChannel
 * @augments Channel
 */

/**
 * A fabric-client Channel with a more flexible constructor that keeps track of transactionIds
 * @param {Channel} channel - Upgrades a fabric-client Channel to keep track of recent transactions
 * @param opts - The options for upgrading the channel
 * @param {string} opts.transactionTimeMapLifetime - The amount of time to remember past transaction IDs
 * @returns The FcwChannel
 */
export function upgradeChannelToFcwChannel(
    channel: Channel,
    { transactionTimeMapLifetime }: FcwChannelOpts
): Channel {
    channel.transactionIdTimeMap = new TransactionIdTimeMap(
        transactionTimeMapLifetime
    )

    /**
     * Gets the TransactionIdTimeMap instance
     * @typedef getTransactionIdTimeMap
     * @memberof FcwChannel#
     * @returns {TransactionIdMap} The TransactionIdMap of the FcwChannel
     */
    channel.getTransactionIdTimeMap = () => channel.transactionIdTimeMap
    return channel
}

/**
 * Creates a fabric-client Channel that keeps track of transactionIds
 * @param opts - The options for creating the Channel
 * @param {string} opts.channelName - The name of the channel
 * @param {FabricClient|UserClient} [opts.client] - The client context to use for operations
 * @param {Array<Peer>} [opts.peers] - An array of peers to use for channel operations
 * @param {Array<Orderer>} opts.orderers - The orderers to use for the channel
 * @param {string} opts.transactionTimeMapLifetime - The amount of time to remember past transaction IDs
 */
export function newFcwChannel({
    channelName,
    client,
    peers = [],
    orderers = [],
    transactionTimeMapLifetime
}: NewFcwChannelOpts): Channel {
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

/**
 * Checks whether an object is a FcwChannel
 * @param obj - The object to check
 * @returns true if the object is a FcwChannel, false otherwise
 */
export function isFcwChannel(obj: any): boolean {
    return obj.getPeers && obj.getTransactionIdTimeMap
}
