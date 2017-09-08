import ChannelStub from './ChannelStub'

export default class FcwChannelStub extends ChannelStub {
    constructor({ channelName, client, peers = [], orderer }) {
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
