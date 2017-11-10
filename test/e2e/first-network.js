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
import networkBootstrap from '../setup/networkBootstrap'
import fcw from '../../lib'
// TODO move above relative imports once https://jira.hyperledger.org/browse/FAB-6957 is fixed
import FabricCAClient from 'fabric-ca-client' // eslint-disable-line import/first

describe('first-network', function() {
    let network

    before(async function() {
        this.timeout(15 * 60 * 1000)
        network = await networkBootstrap(path.join(__dirname, '../fixtures/network-configs/first-network.json'))
        const org1 = network.organizations.Org1MSP
        expect(
            await org1.admins.greg.isChaincodeInstalled(
                network.channel,
                network.chaincode.id,
                network.chaincode.version
            )
        ).to.be.true
        expect(await org1.admins.greg.isChannelCreated(network.channel)).to.be.true
        expect(await org1.admins.greg.isChannelJoined(network.channel)).to.be.true
        expect(
            await org1.admins.greg.isChaincodeInstantiated(
                network.channel,
                network.chaincode.id,
                network.chaincode.version
            )
        ).to.be.true
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
        expect(invokeResponse.data).to.be.an('object')
        expect(invokeResponse.data.transactionResponse).to.be.an('object')
        expect(invokeResponse.data.proposalResponse).to.be.an('object')
        expect(invokeResponse.data.transactionId).to.be.a('string')
        expect(invokeResponse.wait).to.be.a('function')
        await invokeResponse.wait({ race: true })

        const queryResponse = await transactor.query('query', ['a'])
        expect(queryResponse).to.be.an('object')
        expect(queryResponse.data).to.be.an('object')
        expect(queryResponse.data.status).to.equal(200)
        expect(queryResponse.data.message).to.equal('OK')
        expect(parseFloat(queryResponse.data.payload.toString())).to.be.a('number')

        // buffer example
        const queryResponse2 = await transactor.query('query', Buffer.from('a', 'utf8'))
        expect(queryResponse2).to.be.an('object')
        expect(queryResponse2.data).to.be.an('object')
        expect(queryResponse2.data.status).to.equal(200)
        expect(queryResponse2.data.message).to.equal('OK')
        expect(parseFloat(queryResponse2.data.payload.toString())).to.be.a('number')
    })

    it('should listen to an event', function(done) {
        this.timeout(60000)
        const org1 = network.organizations.Org1MSP
        const transactor = fcw(
            org1.admins.greg,
            network.channel,
            network.chaincode.id,
            network.chaincode.endorsementPolicy
        )
        const { eventHubManager, handle } = transactor.registerChaincodeEventListener('test', event => {
            try {
                expect(event).to.be.an('object')
                expect(event.tx_id).to.be.a('string')
                expect(event.payload.toString()).to.equal('hello')
                eventHubManager.unregisterChaincodeEvent(handle)
                done()
            } catch (error) {
                done(error)
            }
        })
        eventHubManager.waitEventHubConnected().then(() => {
            transactor.invoke('event')
        })
    })

    it('should try load the admin from the store', async function() {
        await fcw.createUserClientFromStore({
            ...network.organizations.Org1MSP.config,
            username: 'greg',
        })
        await fcw.createUserClientFromStore({
            userClient: network.organizations.Org1MSP.admins.greg,
            username: 'greg',
        })
    })

    it('should register+enroll a new user and try load it from the store', async function() {
        this.timeout(60000)
        const fabricCAClient = new FabricCAClient(
            'https://localhost:7054',
            null,
            '',
            network.organizations.Org1MSP.config.cryptoSuite
        )

        const caAdmin = await fcw.createUserClientFromCAEnroll({
            fabricCAClient,
            enrollmentConfig: {
                username: 'admin',
                secret: 'adminpw',
            },
            ...network.organizations.Org1MSP.config,
        })

        const username = uuidv4()
        await fcw.createUserClientFromCARegisterAndEnroll({
            userClient: caAdmin,
            username,
            affiliation: 'org1.department1',
        })

        await fcw.createUserClientFromStore({
            userClient: network.organizations.Org1MSP.admins.greg,
            username,
        })
        await fcw.createUserClientFromStore({
            userClient: caAdmin,
            username,
        })
        await fcw.createUserClientFromStore({
            ...network.organizations.Org1MSP.config,
            username,
        })
    })
})
