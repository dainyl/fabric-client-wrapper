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
import wrangleTreeForReqs from './wrangleTreeForReqs'
import type { Policy } from './FABRIC_FLOW_TYPES'

const makeValidatorForIdentities = identities => myPrincipal => requiredPrincipal => {
    if (myPrincipal === requiredPrincipal) {
        return true
    }
    const myId = identities[myPrincipal]
    const requiredId = identities[requiredPrincipal]
    return myId.role.mspId === requiredId.role.mspId && requiredId.role.name === 'member'
}

/**
 * Picks peers from a larger set that satisfy an endorsement policy
 * @param peers the larger set of peers to pick from
 * @param policy the endorsment policy to satisfy
 * @returns An array of Peers that satisfy the policy
 */
export default function pickPeersForPolicy(peers: Array<Peer>, policy: Policy): Array<Peer> {
    const availableMap = {}
    peers.forEach(peer => {
        const role = peer.getRole()
        const idKey = `${peer.getMspId()}${role}`
        if (typeof availableMap[idKey] === 'undefined') {
            availableMap[idKey] = 1
        } else {
            availableMap[idKey] += 1
        }
    })
    const available = policy.identities.map(identity => {
        const { name, mspId } = identity.role
        const numOfIdentity = availableMap[`${mspId}${name}`]
        return typeof numOfIdentity === 'undefined' ? 0 : numOfIdentity
    })

    const { valid, requiredPrincipals } = wrangleTreeForReqs(
        policy.policy,
        available,
        makeValidatorForIdentities(policy.identities)
    )

    if (!valid) {
        throw new Error('Error, supplied peers cannot match policy')
    }

    const idKeyPeerListMap = {}
    peers.forEach(peer => {
        const role = peer.getRole()
        const idKey = `${peer.getMspId()}${role}`
        if (!idKeyPeerListMap[idKey]) {
            idKeyPeerListMap[idKey] = []
        }
        idKeyPeerListMap[idKey].push(peer)
    })
    let peerList = []
    requiredPrincipals.forEach((requiredNum, index) => {
        const { name, mspId } = policy.identities[index].role
        const availablePeersForId = idKeyPeerListMap[`${mspId}${name}`]
        peerList = peerList.concat(availablePeersForId.slice(0, requiredNum))
    })
    return peerList
}
