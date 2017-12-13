/* eslint class-methods-use-this: 0 */

export default class ChannelStub {
    constructor(client) {
        this.client = client
        this.peers = []
        this.orderer = null
    }

    getGenesisBlock() {
        return Promise.resolve({})
    }

    initialize() {
        return Promise.resolve()
    }

    addPeer(peer) {
        this.peers.push(peer)
    }

    addOrderer(orderer) {
        this.orderer = orderer
    }

    getPeers() {
        return this.peers
    }
}
