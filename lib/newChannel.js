// @flow

import type FabricClient from "fabric-client"
import Channel from "fabric-client/lib/Channel"
import type Peer from "fabric-client/lib/Peer"
import type Orderer from "fabric-client/lib/Orderer"
import type UserClient from "./UserClient"

export type ChannelOpts = {
    channelName: string,
    client: FabricClient | UserClient,
    peers?: Array<Peer>,
    orderers?: Array<Orderer>
}

export default function newChannel({
    channelName,
    client,
    peers,
    orderers
}: ChannelOpts) {
    let channelClient
    if (!client) {
        channelClient = {}
    } else if (client.client) {
        channelClient = client.client
    } else {
        channelClient = client
    }
    const channel = new Channel(channelName, channelClient)

    if (orderers) {
        orderers.forEach(orderer => {
            channel.addOrderer(orderer)
        })
    }

    if (peers) {
        peers.forEach(peer => {
            channel.addPeer(peer)
        })
    }

    return channel
}
