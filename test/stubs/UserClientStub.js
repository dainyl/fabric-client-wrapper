/* eslint class-methods-use-this: 0 */

import { MEMBER_ROLE } from "../../lib/shared"
import ChannelStub from "./ChannelStub"

function createResponse() {
    return Promise.resolve({
        data: {},
        wait: () => Promise.resolve({})
    })
}

export default class UserClientStub {
    constructor(client, organizationConfig, roles = [MEMBER_ROLE]) {
        this.client = client
        this.organizationConfig = organizationConfig
        this.roles = roles
    }

    bindChannel() {
        return new ChannelStub(this.client)
    }

    createChannel() {
        return createResponse()
    }

    joinChannel() {
        return createResponse()
    }

    updateChannel() {
        return createResponse()
    }

    installChaincode() {
        return createResponse()
    }

    instantiateChaincode() {
        return createResponse()
    }

    upgradeChaincode() {
        return createResponse()
    }
}
