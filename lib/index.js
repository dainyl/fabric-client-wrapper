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

// TODO add flowtype module when either https://github.com/facebook/flow/issues/2840 is fixed
// OR .flow.js makes it into the docs
// OR when fcw is moved to a separate repo make a libdef https://flow.org/en/docs/libdefs/

import ChannelSetup from "./ChannelSetup"
import Transactor from "./Transactor"
import UserClient from "./UserClient"
import {
    upgradePeerToFcwPeer,
    createFcwPeer,
    isFcwPeer
} from "./fabric-client-extended/FcwPeer"
import {
    upgradeFcwPeerToEventHubPeer,
    upgradePeerToEventHubPeer,
    createEventHubPeer,
    isEventHubPeer
} from "./fabric-client-extended/EventHubPeer"
import {
    upgradeChannelToFcwChannel,
    createFcwChannel,
    isFcwChannel
} from "./fabric-client-extended/FcwChannel"
import {
    createFileKeyValueStoreAndCryptoSuite,
    createCouchDBKeyValueStoreAndCryptoSuite
} from "./crypto-store-factories"
import {
    createUserClientFromKeys,
    createUserClientFromCAEnroll,
    createUserClientFromCARegisterAndEnroll,
    createUserClientFromStore
} from "./user-client-factories"
import pickPeersForPolicy from "./pickPeersForPolicy"
import { ADMIN_ROLE, CA_ADMIN_ROLE, MEMBER_ROLE } from "./shared"

/**
 * Creates a new object for issuing chaincode transactions or listening for chaincode events
 * @param {UserClient} userClient - The UserClient representing the user performing chaincode transactions
 * @param {Channel} channel - The Channel object representing the channel to transact on
 * @param {string} chaincodeId - The ID of the chaincode being transacted on
 * @param {Array<Peer>|Policy} [peersOrPolicy] - An array of peers to transact with or the endorsement policy to select peers with
 * @property {UserClient} UserClient - Class representing a user and also a wrapper over FabricClient
 * @property {MultiUserClient} MultiUserClient - Class representing multiple UserClient instances, can be used for making channel/chaincode operations
 * @property {FcwPeer} FcwPeer - An extended version of the fabric-client Peer which adds additional information
 * @property {EventHubPeer} EventHubPeer - A Peer that contains an EventHub and other additional information
 * @property {FcwChannel} FcwChannel - A fabric-client Channel with a more flexible constructor
 * @property {createFabricCAClient} createFabricCAClient - Creates a new FabricCaClient
 * @property {createFileKeyValueStoreOrganizationConfig} createFileKeyValueStoreOrganizationConfig - Creates a new OrganizationConfig that's based on a file based key value store
 * @property {createCouchDBKeyValueStoreOrganizationConfig} createCouchDBKeyValueStoreOrganizationConfig - Creates a new OrganizationConfig that's based on a CouchDB key value store
 * @property {createUserClientFromKeys} createUserClientFromKeys - Creates a new UserClient from a public private key pair
 * @property {createUserClientFromCAEnroll} createUserClientFromCAEnroll - Creates a new UserClient from enrolling in the CA
 * @property {createUserClientFromCARegisterAndEnroll} createUserClientFromCARegisterAndEnroll - Creates a new UserClient from registering and enrolling in the CA
 * @property {createUserClientFromStore} createUserClientFromStore - Creates a new UserClient from the key value store
 * @property {pickPeersForPolicy} pickPeersForPolicy - Picks peers from a larger set that satisfy an endorsement policy
 * @property {createUserClientFromCARegisterAndEnroll} createUserClientFromCARegisterAndEnroll - Creates a new UserClient from registering and enrolling in the CA
 * @property {string} ADMIN_ROLE - The string 'admin'
 * @property {string} CA_ADMIN_ROLE - The string 'ca_admin'
 * @property {string} MEMBER_ROLE - The string 'member'
 * @returns {Transactor} The new object for interacting with the chaincode
 */
function fcw(userClient, channel, chaincodeId, endorsingPeers) {
    return new Transactor(userClient, channel, chaincodeId, endorsingPeers)
}

/**
 * creates an object for building and running channel setup requests
 * @memberof fcw
 * @param userClient - The UserClient representing the user setting up the channel
 * @param channelOrChannelName - Either the channel object you wish to use or the name of the channel
 * @param [peers] - The peers you wish to use for the channel, only required when supplying the name of the channel
 * @param [orderer] - The orderer you wish to use for the channel, only required when supplying the name of the channel
 */
fcw.setupChannel = (userClient, channelOrChannelName, peers, orderer) =>
    new ChannelSetup(userClient, channelOrChannelName, peers, orderer)

fcw.UserClient = UserClient
fcw.upgradePeerToFcwPeer = upgradePeerToFcwPeer
fcw.createFcwPeer = createFcwPeer
fcw.isFcwPeer = isFcwPeer
fcw.upgradeFcwPeerToEventHubPeer = upgradeFcwPeerToEventHubPeer
fcw.upgradePeerToEventHubPeer = upgradePeerToEventHubPeer
fcw.createEventHubPeer = createEventHubPeer
fcw.isEventHubPeer = isEventHubPeer
fcw.upgradeChannelToFcwChannel = upgradeChannelToFcwChannel
fcw.createFcwChannel = createFcwChannel
fcw.isFcwChannel = isFcwChannel
fcw.createFileKeyValueStoreAndCryptoSuite = createFileKeyValueStoreAndCryptoSuite
fcw.createCouchDBKeyValueStoreAndCryptoSuite = createCouchDBKeyValueStoreAndCryptoSuite
fcw.createUserClientFromKeys = createUserClientFromKeys
fcw.createUserClientFromCAEnroll = createUserClientFromCAEnroll
fcw.createUserClientFromCARegisterAndEnroll = createUserClientFromCARegisterAndEnroll
fcw.createUserClientFromStore = createUserClientFromStore
fcw.pickPeersForPolicy = pickPeersForPolicy
fcw.ADMIN_ROLE = ADMIN_ROLE
fcw.CA_ADMIN_ROLE = CA_ADMIN_ROLE
fcw.MEMBER_ROLE = MEMBER_ROLE

module.exports = fcw
