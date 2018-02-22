// /**

import { expect } from "chai"
import ChannelSetup from "./ChannelSetup"

import ClientStub from "../test/stubs/ClientStub"
import UserClientStub from "../test/stubs/UserClientStub"
import ChannelStub from "../test/stubs/ChannelStub"

describe("ChannelSetup", function() {
    let channelSetup
    beforeEach(function() {
        const userClient = new UserClientStub(new ClientStub())
        const channel = new ChannelStub("mychannel", {})
        channel.addPeer({})
        channel.addOrderer({})
        channelSetup = new ChannelSetup(userClient, channel)
    })

    it("should run with just a channel", async function() {
        await channelSetup.run()
    })

    it("should run with channel + many operations", async function() {
        await channelSetup
            .withCreateChannel({})
            .withJoinChannel({})
            .withInstallChaincode({})
            .withInstallChaincode({})
            .withInstallChaincode({})
            .withInstantiateChaincode({})
            .withInstantiateChaincode({})
            .withInstantiateChaincode({})
            .run()
    })

    it("should fail with multiple createChannel operations", async function() {
        expect(() =>
            channelSetup
                .withCreateChannel({})
                .withCreateChannel({})
                .run()
        ).to.throw(Error, "createChannel")
    })

    it("should fail with multiple joinChannel operations", async function() {
        expect(() =>
            channelSetup
                .withJoinChannel({})
                .withJoinChannel({})
                .run()
        ).to.throw(Error, "joinChannel")
    })

    it("should fail with multiple updateChannel operations", async function() {
        expect(() =>
            channelSetup
                .withUpdateChannel({})
                .withUpdateChannel({})
                .run()
        ).to.throw(Error, "updateChannel")
    })
})
