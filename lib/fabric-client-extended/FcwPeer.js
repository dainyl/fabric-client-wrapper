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

import Peer from 'fabric-client/lib/Peer'
import type { ConnectionOpts } from '../FABRIC_FLOW_TYPES'
import type { OrganizationConfig } from '../shared'

export type FcwPeerOpts = {
    requestUrl: string,
    connectionOpts: ConnectionOpts,
    organizationConfig?: OrganizationConfig,
    mspId?: string,
    role?: string,
    adminMspIds?: Array<string>,
}

/**
* An extended version of the fabric-client Peer which adds additional information
* @param {EventHubPeerOpts} opts - The options for creating the Peer
* @param {string} opts.requestUrl - The URL to issue requests to the Peer with
* @param {ConnectionOpts} opts.connectionOpts - The options for connecting to the peers request url
* @param {OrganizationConfig} [opts.organizationConfig] - The configuration of the organization that the Peer belongs to. Required if mspId is not specified.
* @param {string} [opts.mspId] - The MSP ID of the organization the peer belongs to
* @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
* @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
*/
export default class FcwPeer extends Peer {
    role: string // TODO remove once fabric-client implements
    mspId: string
    adminMspIds: Array<string>

    constructor({ requestUrl, connectionOpts, organizationConfig, mspId, adminMspIds, role = 'member' }: FcwPeerOpts) {
        super(requestUrl, connectionOpts)
        this.role = role
        this.mspId = organizationConfig ? organizationConfig.mspId : mspId
        if (organizationConfig) {
            this.mspId = organizationConfig.mspId
        } else if (mspId) {
            this.mspId = mspId
        } else {
            throw new Error('Error: FcwPeer requires either organizationConfig or mspId')
        }
        this.adminMspIds = adminMspIds || [this.mspId]
    }

    /**
    * Gets the role of the peer
    */
    getRole(): string {
        return this.role
    }

    /**
    * Sets the role of the peer
    */
    setRole(role: string) {
        this.role = role
    }

    /**
    * Gets the Peer's organization's MSP ID
    */
    getMspId() {
        return this.mspId
    }

    /**
    * Gets an array of MSP ID's for organizations that have admin priviledges over the peer
    */
    getAdminMspIds() {
        return this.adminMspIds
    }
}
