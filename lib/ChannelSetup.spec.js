// /**
//  * Copyright 2017 IBM All Rights Reserved.
//  *
//  * Licensed under the Apache License, Version 2.0 (the 'License');
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *    http://www.apache.org/licenses/LICENSE-2.0
//  *
//  *  Unless required by applicable law or agreed to in writing, software
//  *  distributed under the License is distributed on an 'AS IS' BASIS,
//  *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  *  See the License for the specific language governing permissions and
//  *  limitations under the License.
//  */

import { expect } from 'chai'
import ChannelSetup from './ChannelSetup'

import ClientStub from '../test/stubs/ClientStub'
import UserClientStub from '../test/stubs/UserClientStub'
import FcwChannelStub from '../test/stubs/FcwChannelStub'

describe.only('ChannelSetup', function() {
    let channelSetup
    beforeEach(function() {
        const userClient = new UserClientStub(new ClientStub())
        const channel = new FcwChannelStub({ client: userClient, peers: [], orderer: {} })
        channelSetup = new ChannelSetup(userClient, channel)
    })

    it('should run with just a channel', async function() {
        await channelSetup.run()
    })

    it('should run with channel + many operations', async function() {
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

    it('should fail with multiple createChannel operations', async function() {
        expect(() =>
            channelSetup
                .withCreateChannel({})
                .withCreateChannel({})
                .run()
        ).to.throw(Error, 'createChannel')
    })

    it('should fail with multiple joinChannel operations', async function() {
        expect(() =>
            channelSetup
                .withJoinChannel({})
                .withJoinChannel({})
                .run()
        ).to.throw(Error, 'joinChannel')
    })
})
