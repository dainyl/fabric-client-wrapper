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

import Peer from "fabric-client/lib/Peer"
import type { ConnectionOpts } from "../FABRIC_FLOW_TYPES"

export type FcwPeerOpts = {
    mspId: string,
    role?: string,
    adminMspIds?: Array<string>
}

export type CreateFcwPeerOpts = FcwPeerOpts & {
    requestUrl: string,
    peerOpts: ConnectionOpts
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

export function upgradePeerToFcwPeer(
    peer: Peer,
    { mspId, adminMspIds, role }: FcwPeerOpts
) {
    peer.role = role || "member"
    peer.mspId = mspId
    peer.adminMspIds = adminMspIds || [mspId]

    /**
     * Gets the role of the peer
     */
    peer.getRole = () => peer.role

    /**
     * Sets the role of the peer
     */
    peer.setRole = _role => {
        peer.role = _role
    }

    /**
     * Gets the Peer's organization's MSP ID
     */
    peer.getMspId = () => peer.mspId

    /**
     * Gets an array of MSP ID's for organizations that have admin priviledges over the peer
     */
    peer.getAdminMspIds = () => peer.adminMspIds

    return peer
}

export function createFcwPeer({
    requestUrl,
    peerOpts,
    mspId,
    adminMspIds,
    role
}: CreateFcwPeerOpts) {
    const peer = new Peer(requestUrl, peerOpts)
    return upgradePeerToFcwPeer(peer, { mspId, adminMspIds, role })
}

export function isFcwPeer(obj: any) {
    return obj.getUrl && obj.getMspId
}
