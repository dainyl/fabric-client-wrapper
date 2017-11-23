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

/**
 * fabric-client FabricClient class see {@link https://fabric-sdk-node.github.io/Client.html|Client}
 * @external FabricClient
 */

/**
 * fabric-client Channel class see {@link https://fabric-sdk-node.github.io/Channel.html|Channel}
 * @external Channel
 */

/**
 * fabric-client Peer class see {@link https://fabric-sdk-node.github.io/Peer.html|Peer}
 * @external Peer
 */

/**
 * fabric-client Orderer class see {@link https://fabric-sdk-node.github.io/Orderer.html|Orderer}
 * @external Orderer
 */

/**
 * fabric-client EventHub class see {@link https://fabric-sdk-node.github.io/EventHub.html|EventHub}
 * @external EventHub
 */

/**
 * fabric-client Policy object see the endorsement policy example listed here {@link https://fabric-sdk-node.github.io/global.html#ChaincodeInstantiateUpgradeRequest}
 * @external Policy
 */

/**
 * fabric-client ConnectionOpts object see {@link https://fabric-sdk-node.github.io/global.html#ConnectionOpts|ConnectionOpts}
 * @external ConnectionOpts
 */

/**
 * fabric-client TransactionRequest object see {@link https://fabric-sdk-node.github.io/global.html#TransactionRequest|TransactionRequest}
 * @external TransactionRequest
 */

/**
 * fabric-client CryptoSuite object see {@link https://fabric-sdk-node.github.io/module-api.CryptoSuite.html|CryptoSuite}
 * @external CryptoSuite
 */

/**
 * fabric-client IdentityPEMs object see {@link https://fabric-sdk-node.github.io/global.html#IdentityPEMs|IdentityPEMs}
 * @external IdentityPEMs
 */

/**
 * fabric-client KeyValueStore object see {@link https://fabric-sdk-node.github.io/module-api.KeyValueStore.html|KeyValueStore}
 * @external KeyValueStore
 */

/**
 * fabric-client ProposalResponse object see {@link https://fabric-sdk-node.github.io/global.html#ProposalResponse}
 * @external ProposalResponse
 */

/**
 * fabric-client ProposalResponseObject object see {@link https://fabric-sdk-node.github.io/global.html#ProposalResponseObject}
 * @external ProposalResponseObject
 */

/**
 * fabric-client Block object see {@link https://fabric-sdk-node.github.io/global.html#Block}
 * @external Block
 */

/**
 * fabric-ca-client FabricCAClient class see {@link https://fabric-sdk-node.github.io/FabricCAClient.html|FabricCAClient}
 * @external FabricCAClient
 */

/**
 * fabric-ca-client RegisterRequest object see {@link https://fabric-sdk-node.github.io/global.html#RegisterRequest|RegisterRequest}
 * @external RegisterRequest
 */

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
 * @property {upgradePeerToFcwPeer} upgradePeerToFcwPeer - Upgrades a fabric-client Peer with additional MSP information
 * @property {createFcwPeer} createFcwPeer - Creates a fabric-clietn Peer with additional MSP information
 * @property {isFcwPeer} isFcwPeer - Checks whether an object is a FcwPeer
 * @property {upgradeFcwPeerToEventHubPeer} upgradeFcwPeerToEventHubPeer - Upgrades a FcwPeer with an EventHubManager
 * @property {upgradePeerToEventHubPeer} upgradePeerToEventHubPeer - Upgrades a fabric-client Peer with additional MSP information and an EventHubManager
 * @property {createEventHubPeer} createEventHubPeer - Creates a fabric-client Peer with additional MSP information and an EventHubManager
 * @property {isEventHubPeer} isEventHubPeer - Checks whether an object is an EventHubPeer
 * @property {upgradeChannelToFcwChannel} upgradeChannelToFcwChannel - Upgrades a fabric-client Channel to keep track of recent transactions
 * @property {createFcwChannel} createFcwChannel - Creates a fabric-client Channel that keeps track of recent transactions
 * @property {isFcwChannel} isFcwChannel - Checks whether an object is a FcwChannel
 * @property {createFileKeyValueStoreAndCryptoSuite} createFileKeyValueStoreAndCryptoSuite - Creates a new file based key-value store and the associated cryptoSuite
 * @property {createCouchDBKeyValueStoreAndCryptoSuite} createCouchDBKeyValueStoreAndCryptoSuite - Creates a new CouchDB based key-value and the associated cryptoSuite
 * @property {createUserClientFromKeys} createUserClientFromKeys - Creates a new UserClient from a public private key pair
 * @property {createUserClientFromCAEnroll} createUserClientFromCAEnroll - Creates a new UserClient from enrolling in the CA
 * @property {createUserClientFromCARegisterAndEnroll} createUserClientFromCARegisterAndEnroll - Creates a new UserClient from registering and enrolling in the CA
 * @property {createUserClientFromStore} createUserClientFromStore - Creates a new UserClient from the key value store
 * @property {pickPeersForPolicy} pickPeersForPolicy - Picks peers from a larger set that satisfy an endorsement policy
 * @property {string} ADMIN_ROLE - The string 'admin'
 * @property {string} CA_ADMIN_ROLE - The string 'ca_admin'
 * @property {string} MEMBER_ROLE - The string 'member'
 * @returns {Transactor} The new object for interacting with the chaincode
 */
function fcw(userClient, channel, chaincodeId, peersOrPolicy) {
    return new Transactor(userClient, channel, chaincodeId, peersOrPolicy)
}

/**
 * creates an object for building and running channel setup requests
 * @memberof fcw
 * @param userClient - The UserClient representing the user setting up the channel
 * @param channelOrChannelOpts - Either the channel object you wish to use or the arguments to create a new channel
 * @param [opts] - Additional options
 * @param {boolean} [opts.swallowAlreadyCreatedErrors] - Option to swallow errors about channel being already created/joined or chaincode being installed/instantiated
 * @param [opts.network] - Network options
 * @param {boolean} [opts.network.leader] - Whether to be the network leader (the server)
 * @param {Array<string>} [opts.network.mspIds] - The MSP IDs that the org represents, only required for non-leaders
 * @param {Array<string>} [opts.network.externalMspIds] - The MSP IDs of external organisations. Is optional and is only used by leader
 * @param {string} [opts.network.host] - The host of the server. Is optional and is only used by non-leaders.
 * @param {string} [opts.network.port=45207] - The port to communicate on.
 * @param {number} [opts.network.timeout] - The maximum amount of time to wait between various stages of the network setup phase
 * @param {Function} [opts.network.onError] - Callback function for socket errors
 * @returns {Promise<Channel>} - The setup channel
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
