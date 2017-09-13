/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import uuidv4 from 'uuid/v4'
import path from 'path'
import { expect } from 'chai'
import networkBootstrap from '../helpers/networkBootstrap'
import fcw from '../../lib'

describe('first-network', function() {
    let network

    before(async function() {
        this.timeout(60000)
        network = await networkBootstrap(path.join(__dirname, '../fixtures/network-configs/first-network.json'))
    })

    it('should make a transaction', async function() {
        this.timeout(60000)
        const org1 = network.organizations.Org1MSP
        const transactor = fcw(
            org1.admins.greg,
            network.channel,
            network.chaincode.id,
            network.chaincode.endorsementPolicy
        )

        const invokeResponse = await transactor.invoke('move', ['a', 'b', '10'])
        expect(invokeResponse.transactionResponse).to.be.a('object')
        expect(invokeResponse.proposalResponse).to.be.a('object')
        expect(invokeResponse.transactionId).to.be.a('string')

        const queryResponse = await transactor.query('query', ['a'])
        expect(queryResponse).to.be.a('object')
        expect(queryResponse.status).to.equal(200)
        expect(queryResponse.message).to.equal('OK')
        expect(parseFloat(queryResponse.payload)).to.be.a('number')
    })

    it('should try load the admin from the store', async function() {
        await fcw.createUserClientFromStore('greg', {
            organizationConfig: network.organizations.Org1MSP.config,
        })
        await fcw.createUserClientFromStore('greg', {
            userClient: network.organizations.Org1MSP.admins.greg,
        })
    })

    it('should register+enroll a new user and try load it from the store', async function() {
        this.timeout(60000)
        const fabricCAClient = fcw.createFabricCAClient('https://localhost:7054', network.organizations.Org1MSP.config)
        const caAdmin = await fcw.createUserClientFromCAEnroll(
            fabricCAClient,
            {
                username: 'admin',
                secret: 'adminpw',
            },
            network.organizations.Org1MSP.config
        )
        caAdmin.setFabricCAClient(fabricCAClient)

        const username = uuidv4()
        await fcw.createUserClientFromCARegisterAndEnroll(caAdmin, username, 'org1.department1')

        await fcw.createUserClientFromStore(username, {
            userClient: network.organizations.Org1MSP.admins.greg,
        })
        await fcw.createUserClientFromStore(username, {
            userClient: caAdmin,
        })
        await fcw.createUserClientFromStore(username, {
            organizationConfig: network.organizations.Org1MSP.config,
        })
    })
})
