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

export type NewFcwPeerOpts = FcwPeerOpts & {
    requestUrl: string,
    peerOpts: ConnectionOpts
}

/**
 * A fabric-client Peer with additional MSP information
 * @typedef {Object} FcwPeer
 * @augments Peer
 */

/**
 * Upgrades a fabric-client Peer with additional MSP information
 * @param {Peer} peer
 * @param opts - The options for upgrading the Peer
 * @param {string} opts.mspId - The MSP ID of the organization the peer belongs to
 * @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
 * @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
 * @returns {FcwPeer} The FcwPeer
 */
export function upgradePeerToFcwPeer(
    peer: Peer,
    { mspId, adminMspIds, role: peerRole = "member" }: FcwPeerOpts
): Peer {
    peer.role = peerRole
    peer.mspId = mspId
    peer.adminMspIds = adminMspIds || [mspId]

    /**
     * Gets the role of the peer
     * @typedef getRole
     * @memberof FcwPeer#
     */
    peer.getRole = () => peer.role

    /**
     * Sets the role of the peer
     * @typedef setRole
     * @memberof FcwPeer#
     * @param role - The role of the peer
     */
    peer.setRole = (role: string) => {
        peer.role = role
    }

    /**
     * Gets the Peer's organization's MSP ID
     * @typedef getMspId
     * @memberof FcwPeer#
     */
    peer.getMspId = () => peer.mspId

    /**
     * Gets an array of MSP ID's for organizations that have admin priviledges over the peer
     * @typedef getAdminMspIds
     * @memberof FcwPeer#
     */
    peer.getAdminMspIds = () => peer.adminMspIds

    return peer
}

/**
 * Creates a fabric-client Peer with additional MSP information
 * @param opts - The options for creating the FcwPeer
 * @param {string} opts.requestUrl - The URL to issue requests to the Peer with
 * @param {ConnectionOpts} opts.peerOpts - The options for connecting to the peer's request url
 * @param {string} opts.mspId - The MSP ID of the organization the peer belongs to
 * @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
 * @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
 * @returns {FcwPeer} The FcwPeer
 */
export function newFcwPeer({
    requestUrl,
    peerOpts,
    mspId,
    adminMspIds,
    role
}: NewFcwPeerOpts): Peer {
    const peer = new Peer(requestUrl, peerOpts)
    return upgradePeerToFcwPeer(peer, { mspId, adminMspIds, role })
}

/**
 * Checks whether an object is a FcwPeer
 * @param obj - The object to check
 * @returns true if the object is a FcwPeer, false otherwise
 */
export function isFcwPeer(obj: any): boolean {
    return obj.getUrl && obj.getMspId
}
