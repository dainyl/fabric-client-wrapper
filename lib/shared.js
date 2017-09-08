// @flow
/* eslint import/prefer-default-export: 0 */
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

import type Peer from 'fabric-client/lib/Peer'
import type { CryptoSuite, KeyValueStore } from 'fabric-client/lib/api'
import type { CryptoContent, Policy } from './FABRIC_FLOW_TYPES'

export type UserKeyConfig = {
    username: string,
    cryptoContent: CryptoContent,
}

export type AdminClient = {
    username: string,
    keyPem: string,
    certPem: string,
}

export type OrdererConfig = {
    url: string,
    serverHostname: string,
    pem: string,
}

export type EnrollmentConfig = {
    username: string,
    secret: string,
}

export type PeerConfig = {
    peerName: string,
    requestUrl: string,
    eventUrl: string,
    serverHostname: string,
    pem: string,
}

export type OrganizationConfig = {
    mspId: string,
    cryptoSuite: CryptoSuite,
    store: KeyValueStore, // TODO set proper type
}

export type FcwChaincodeInstantiateUpgradeRequest = {
    targets?: Array<Peer>,
    targetsPolicy?: Policy,
    chaincodeType?: string,
    chaincodeId: string,
    chaincodeVersion: string,
    transientMap?: Object,
    fcn?: string,
    args: Array<string>,
    'endorsement-policy'?: Object,
}

export const ADMIN_ROLE = 'admin'
export const CA_ADMIN_ROLE = 'ca_admin'
export const MEMBER_ROLE = 'member'
