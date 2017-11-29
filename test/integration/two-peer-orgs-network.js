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
import uuidv4 from "uuid/v4"
import path from "path"
import { expect } from "chai"
import { execSync } from "child_process"

import request from "request"
import networkBootstrap from "../util/networkBootstrap"
import fcw from "../../lib"
// TODO move above relative imports once https://jira.hyperledger.org/browse/FAB-6957 is fixed
import FabricCAClient from "fabric-ca-client" // eslint-disable-line import/first

const superagentPromise = require("superagent-promise")(
    require("superagent"),
    Promise
)

function cleanDocker() {
    // stop and remove chaincode docker instances
    try {
        execSync(
            "docker kill $(docker ps | grep \"dev-peer0.org[12].example.com-e\" | awk '{print $1}')",
            {
                stdio: "ignore"
            }
        )
    } catch (error) {
        // ignore errors
    }
    try {
        execSync(
            "docker rm $(docker ps -a | grep \"dev-peer0.org[12].example.com-e\" | awk '{print $1}')",
            {
                stdio: "ignore"
            }
        )
    } catch (error) {
        // ignore errors
    }
    // remove chaincode images so that they get rebuilt during test
    try {
        execSync(
            "docker rmi $(docker images | grep \"^dev-peer0.org[12].example.com-e\" | awk '{print $3}')",
            {
                stdio: "ignore"
            }
        )
    } catch (error) {
        // ignore errors
    }
    // clean up all the containers created by docker-compose
    try {
        execSync(`docker-compose down`, {
            stdio: "ignore",
            cwd: path.join(
                __dirname,
                "../fixtures/network/two-peer-orgs-network"
            )
        })
    } catch (error) {
        // ignore errors
    }
}

function startDocker() {
    execSync(`docker-compose up -d`, {
        stdio: "ignore",
        cwd: path.join(__dirname, "../fixtures/network/two-peer-orgs-network")
    })
}

describe("two-peer-orgs-network", function() {
    let network

    before(async function() {
        this.timeout(15 * 60 * 1000)

        // clean up docker containers and images
        cleanDocker()

        // start docker containers
        startDocker()

        // setup network
        network = await networkBootstrap(
            path.join(
                __dirname,
                "../fixtures/network-configs/two-peer-orgs-network.json"
            )
        )
        const org1 = network.organizations.Org1MSP
        expect(
            await org1.admins.greg.isChaincodeInstalled(
                network.channel,
                network.chaincode.id,
                network.chaincode.version
            )
        ).to.be.true
        expect(
            await org1.admins.greg.isChannelCreated(network.channel)
        ).to.be.true
        expect(
            await org1.admins.greg.isChannelJoined(network.channel)
        ).to.be.true
        expect(
            await org1.admins.greg.isChaincodeInstantiated(
                network.channel,
                network.chaincode.id,
                network.chaincode.version
            )
        ).to.be.true
    })

    it("should make a transaction", async function() {
        this.timeout(60000)
        const org1 = network.organizations.Org1MSP
        const transactor = fcw(
            org1.admins.greg,
            network.channel,
            network.chaincode.id,
            network.chaincode.endorsementPolicy
        )

        const invokeResponse = await transactor.invoke("move", ["a", "b", "10"])
        expect(invokeResponse.data).to.be.an("object")
        expect(invokeResponse.data.transactionResponse).to.be.an("object")
        expect(invokeResponse.data.proposalResponse).to.be.an("object")
        expect(invokeResponse.data.transactionId).to.be.a("string")
        expect(invokeResponse.wait).to.be.a("function")
        await invokeResponse.wait({ race: true })

        const queryResponse = await transactor.query("query", ["a"])
        expect(queryResponse).to.be.an("object")
        expect(queryResponse.data).to.be.an("object")
        expect(queryResponse.data.status).to.equal(200)
        expect(queryResponse.data.message).to.equal("OK")
        expect(parseFloat(queryResponse.data.payload.toString())).to.be.a(
            "number"
        )

        // buffer example
        const queryResponse2 = await transactor.query(
            "query",
            Buffer.from("a", "utf8")
        )
        expect(queryResponse2).to.be.an("object")
        expect(queryResponse2.data).to.be.an("object")
        expect(queryResponse2.data.status).to.equal(200)
        expect(queryResponse2.data.message).to.equal("OK")
        expect(parseFloat(queryResponse2.data.payload.toString())).to.be.a(
            "number"
        )
    })

    it("should listen to an event", function(done) {
        this.timeout(60000)
        const org1 = network.organizations.Org1MSP
        const transactor = fcw(
            org1.admins.greg,
            network.channel,
            network.chaincode.id,
            network.chaincode.endorsementPolicy
        )
        const {
            eventHubManager,
            handle
        } = transactor.registerChaincodeEventListener("test", event => {
            try {
                expect(event).to.be.an("object")
                expect(event.tx_id).to.be.a("string")
                expect(event.payload.toString()).to.equal("hello")
                eventHubManager.unregisterChaincodeEvent(handle)
                done()
            } catch (error) {
                done(error)
            }
        })
        eventHubManager.waitEventHubConnected().then(() => {
            transactor.invoke("event")
        })
    })

    it("should try load the admin from the store", async function() {
        await fcw.newUserClientFromStore({
            ...network.organizations.Org1MSP.config,
            username: "greg"
        })
        await fcw.newUserClientFromStore({
            userClient: network.organizations.Org1MSP.admins.greg,
            username: "greg"
        })
    })

    it("should register+enroll a new user and try load it from the store", async function() {
        this.timeout(60000)
        const fabricCAClient = new FabricCAClient(
            "https://localhost:7054",
            null,
            "",
            network.organizations.Org1MSP.config.cryptoSuite
        )

        const caAdmin = await fcw.newUserClientFromCAEnroll({
            fabricCAClient,
            enrollmentID: "admin",
            enrollmentSecret: "adminpw",
            username: "caAdmin",
            ...network.organizations.Org1MSP.config
        })

        const username = uuidv4()
        await fcw.newUserClientFromCARegisterAndEnroll({
            userClient: caAdmin,
            registerRequest: {
                enrollmentID: username,
                affiliation: "org1.department1"
            }
        })

        await fcw.newUserClientFromStore({
            userClient: network.organizations.Org1MSP.admins.greg,
            username
        })
        await fcw.newUserClientFromStore({
            userClient: caAdmin,
            username
        })
        await fcw.newUserClientFromStore({
            ...network.organizations.Org1MSP.config,
            username
        })
    })

    it("should register+enroll a new user under a different username and try load it from the store", async function() {
        this.timeout(60000)
        const fabricCAClient = new FabricCAClient(
            "https://localhost:7054",
            null,
            "",
            network.organizations.Org1MSP.config.cryptoSuite
        )

        const caAdmin = await fcw.newUserClientFromCAEnroll({
            fabricCAClient,
            enrollmentID: "admin",
            enrollmentSecret: "adminpw",
            username: "caAdmin",
            ...network.organizations.Org1MSP.config
        })

        const username = "foobar"
        await fcw.newUserClientFromCARegisterAndEnroll({
            userClient: caAdmin,
            registerRequest: {
                enrollmentID: uuidv4(),
                affiliation: "org1.department1"
            },
            username
        })

        await fcw.newUserClientFromStore({
            userClient: network.organizations.Org1MSP.admins.greg,
            username
        })
        await fcw.newUserClientFromStore({
            userClient: caAdmin,
            username
        })
        await fcw.newUserClientFromStore({
            ...network.organizations.Org1MSP.config,
            username
        })
    })

    it("should upgrade a chaincode", async function() {
        this.timeout(10 * 60000)
        const admins = [
            network.organizations.Org1MSP.admins.greg,
            network.organizations.Org2MSP.admins.peerOrg2Admin
        ]
        await Promise.all(
            admins.map((admin, index) =>
                fcw
                    .setupChannel(admin, network.channel, {
                        network: {
                            leader: index === 0,
                            host: "localhost",
                            timeout: 10 * 60000
                        }
                    })
                    .withInstallChaincode(
                        {
                            chaincodeId: network.chaincode.id,
                            chaincodePath: "github.com/example_cc",
                            chaincodeVersion: "v1"
                        },
                        {
                            timeout: 10 * 60000
                        }
                    )
                    .withUpgradeChaincode(
                        {
                            chaincodeId: network.chaincode.id,
                            chaincodeVersion: "v1",
                            fcn: "init",
                            args: ["a", "100", "b", "200"]
                        },
                        {
                            timeout: 10 * 60000,
                            waitOpts: {
                                timeout: 10 * 60000
                            }
                        }
                    )
                    .run()
            )
        )
    })

    it("should update the channel", async function() {
        this.timeout(60000)
        const org1Channel = network.organizations.Org1MSP.admins.greg.bindChannel(
            network.channel
        )
        const configEnvelope = await org1Channel.getChannelConfig()
        const originalConfigProto = configEnvelope.config.toBuffer()
        superagentPromise
        const decodeResponse = await superagentPromise
            .post(
                "http://127.0.0.1:7059/protolator/decode/common.Config",
                originalConfigProto
            )
            .buffer()
        const updatedConfig = JSON.parse(decodeResponse.text.toString())
        if (
            updatedConfig.channel_group.groups.Orderer.values.BatchSize.value
                .max_message_count === 10
        ) {
            updatedConfig.channel_group.groups.Orderer.values.BatchSize.value.max_message_count = 20
        } else {
            updatedConfig.channel_group.groups.Orderer.values.BatchSize.value.max_message_count = 10
        }

        const encodeResponse = await superagentPromise
            .post(
                "http://127.0.0.1:7059/protolator/encode/common.Config",
                JSON.stringify(updatedConfig)
            )
            .buffer()

        const updatedConfigProto = encodeResponse.body

        const formData = {
            channel: network.channel.getName(),
            original: {
                value: originalConfigProto,
                options: {
                    filename: "original.proto",
                    contentType: "application/octet-stream"
                }
            },
            updated: {
                value: updatedConfigProto,
                options: {
                    filename: "updated.proto",
                    contentType: "application/octet-stream"
                }
            }
        }
        const completeProto = await new Promise((resolve, reject) => {
            request.post(
                {
                    url:
                        "http://127.0.0.1:7059/configtxlator/compute/update-from-configs",
                    formData
                },
                function optionalCallback(err, res, body) {
                    if (err) {
                        reject(err)
                    } else {
                        const proto = new Buffer(body, "binary")
                        resolve(proto)
                    }
                }
            )
        })
        const org1Sig = network.organizations.Org1MSP.admins.greg.signChannelConfig(
            completeProto
        )
        const org2Sig = network.organizations.Org2MSP.admins.peerOrg2Admin.signChannelConfig(
            completeProto
        )
        const ordererSig = network.organizations.OrdererMSP.admins.ordererAdmin.signChannelConfig(
            completeProto
        )
        const signatures = [org1Sig, org2Sig, ordererSig]
        await fcw
            .setupChannel(
                network.organizations.Org1MSP.admins.greg,
                network.channel
            )
            .withUpdateChannel({
                config: completeProto,
                signatures
            })
            .run()
    })
})
