// @flow
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

import _ from 'lodash/fp'
import { mapValues } from 'lodash'
import fs from 'fs'
import path from 'path'
import Orderer from 'fabric-client/lib/Orderer'
import fcw, {
    FcwChannel,
    MultiUserClient,
    createUserClientFromKeys,
    createFileKeyValueStoreOrganizationConfig,
    ADMIN_ROLE,
} from '../../lib'

/**
 * Utility function to replace all the values in a JSON object that look like
 * relative paths, into absolute paths
 * @param {JSON} config - The object that represents a configuration.
 * @param {refPath} refPath - A string that represents the path to be taken
 * @param {key} key - A key that represents a key asssociated with the configuration
 * relative from .
 * @returns {JSON} - Returns the configuration with the relative paths.
 */
export function makeNetworkConfigRelativePathsAbsolute(config: any, refPath: string, key?: string): any {
    const makeAbsoluteFilePathKeys = ['genesisBlock', 'tx', 'tlsca', 'keystore', 'signcerts']
    if (makeAbsoluteFilePathKeys.includes(key)) {
        if (_.isArray(config)) {
            return config.map(string => path.resolve(refPath, string))
        }
        return path.resolve(refPath, config)
    }
    if (!_.isObject(config)) {
        return config
    }
    if (_.isArray(config)) {
        return config.map(elem => makeNetworkConfigRelativePathsAbsolute(elem, refPath))
    }
    return mapValues(config, (v, k) => makeNetworkConfigRelativePathsAbsolute(v, refPath, k))
}

function parseOrganizationsJSON(organizationsJSON) {
    return Promise.all(
        organizationsJSON.map(async ({ mspId, tlsca: tlscaPath, users: usersJSON, peers: peersJSON }) => {
            const organization = {
                peers: [],
                config: null,
                admins: {},
                members: {},
            }
            organization.config = await createFileKeyValueStoreOrganizationConfig(
                mspId,
                path.join(__dirname, '../', `${mspId}_keystore`)
            )
            await Promise.all(
                usersJSON.map(async userJSON => {
                    const keystoreFileName = fs.readdirSync(userJSON.keystore)[0]
                    const signCertFileName = fs.readdirSync(userJSON.signcerts)[0]
                    const privateKeyPEM = fs.readFileSync(path.join(userJSON.keystore, keystoreFileName)).toString()
                    const signedCertPEM = fs.readFileSync(path.join(userJSON.signcerts, signCertFileName)).toString()

                    const user = await createUserClientFromKeys(
                        {
                            username: userJSON.username,
                            cryptoContent: {
                                privateKeyPEM,
                                signedCertPEM,
                            },
                        },
                        organization.config,
                        [userJSON.role]
                    )
                    if (userJSON.role === ADMIN_ROLE) {
                        organization.admins[userJSON.username] = user
                    } else {
                        organization.members[userJSON.username] = user
                    }
                })
            )
            const endorserFilterLambda = peerJSON => peerJSON.type === 'endorserValidator'
            if (peersJSON.find(endorserFilterLambda)) {
                const admin: any = Object.values(organization.admins)[0]
                const tlscaPem = Buffer.from(fs.readFileSync(tlscaPath)).toString()
                peersJSON.filter(endorserFilterLambda).forEach(peerJSON => {
                    organization.peers.push(
                        admin.createEventHubPeer({
                            requestUrl: peerJSON.requests,
                            eventUrl: peerJSON.events,
                            connectionOpts: {
                                pem: tlscaPem,
                                'ssl-target-name-override': peerJSON['server-hostname'],
                            },
                        })
                    )
                })
            }
            return organization
        })
    )
}

function parseOrganizationsJSONForOrderer(organizationsJSON, ordererId) {
    const ordererFilterLambda = peerJSON => peerJSON.type === 'orderer' && peerJSON.url.includes(ordererId)
    const ordererOrganizationJSON = organizationsJSON.find(organizationJSON =>
        organizationJSON.peers.find(ordererFilterLambda)
    )
    const ordererPeerJSON = ordererOrganizationJSON.peers.find(ordererFilterLambda)
    const tlscaPem = Buffer.from(fs.readFileSync(ordererOrganizationJSON.tlsca)).toString()
    return new Orderer(ordererPeerJSON.url, {
        'ssl-target-name-override': ordererPeerJSON['server-hostname'],
        pem: tlscaPem,
    })
}

function parseOrganizationsContainingPeers(organizations, peerIds) {
    return organizations.filter(org => org.peers.some(peer => peerIds.some(peerId => peer.getUrl().includes(peerId))))
}

function createCreateChannelOpts(organizations, channelConfigEnvelope) {
    const admins = _.flatten(organizations.map(organization => Object.values(organization.admins)))
    const channelConfig = admins[0].extractChannelConfig(channelConfigEnvelope)
    const signatures = admins.map(admin => admin.signChannelConfig(channelConfig))

    return {
        channelConfig,
        signatures,
    }
}

async function parseChannelChaincodeJSON(organizations, channelJSON, organizationsJSON) {
    const { chaincode: chaincodeJSON, orderer: ordererId, peers: peerIds } = channelJSON
    const orderer = parseOrganizationsJSONForOrderer(organizationsJSON, ordererId)
    const channelOrgs = parseOrganizationsContainingPeers(organizations, peerIds)
    const channelAdmins = channelOrgs.map(org => Object.values(org.admins)[0])
    const createChannelOpts = createCreateChannelOpts(organizations, fs.readFileSync(channelJSON.tx))
    const channelPeerFilterLambda = peer => peerIds.some(peerId => peer.getUrl().includes(peerId))
    const peers = _.flatten(organizations.map(organization => organization.peers)).filter(channelPeerFilterLambda)
    const channel = new FcwChannel({
        channelName: channelJSON.name,
        peers,
        orderer,
    })

    await fcw
        .setupChannel(new MultiUserClient(channelAdmins), channel, true)
        .withCreateChannel(createChannelOpts)
        .withInstallChaincode(
            {
                chaincodeId: chaincodeJSON.id,
                chaincodePath: chaincodeJSON.path,
                chaincodeVersion: chaincodeJSON.version,
            },
            5 * 60000
        )
        .withJoinChannel()
        .withInstantiateChaincode(
            {
                chaincodeId: chaincodeJSON.id,
                chaincodeVersion: chaincodeJSON.version,
                fcn: chaincodeJSON.instantiate.fcn,
                args: chaincodeJSON.instantiate.args,
                targetsPolicy: chaincodeJSON['instantiation-policy'],
                'endorsement-policy': chaincodeJSON['endorsement-policy'],
            },
            5 * 60000
        )
        .run()

    return {
        channel,
        chaincode: {
            id: chaincodeJSON.id,
            version: chaincodeJSON.version,
            instantiationPolicy: chaincodeJSON['instantiation-policy'],
            endorsementPolicy: chaincodeJSON['endorsement-policy'],
        },
    }
}

export default async function networkBootstrap(networkConfigPath: string) {
    const networkConfigDir = networkConfigPath.substring(
        0,
        Math.max(networkConfigPath.lastIndexOf('/'), networkConfigPath.lastIndexOf('\\'))
    )
    const networkConfigJSON = JSON.parse(fs.readFileSync(networkConfigPath).toString())
    const absolutePathNetworkConfigJSON = makeNetworkConfigRelativePathsAbsolute(networkConfigJSON, networkConfigDir)
    const { channel: channelJSON, organizations: organizationsJSON } = absolutePathNetworkConfigJSON.network
    const organizations = await parseOrganizationsJSON(organizationsJSON)
    const { channel, chaincode } = await parseChannelChaincodeJSON(organizations, channelJSON, organizationsJSON)
    const organizationsByMspId = _.keyBy(org => org.config.mspId)(organizations)
    return {
        organizations: organizationsByMspId,
        channel,
        chaincode,
    }
}
