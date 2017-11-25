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

import _ from "lodash/fp"
import Peer from "fabric-client/lib/Peer"
import wrangleTreeForReqs from "./wrangleTreeForReqs"
import type { Policy } from "./FABRIC_FLOW_TYPES"

const makeValidatorForIdentities = identities => requiredPrincipal => myPrincipal => {
    if (myPrincipal === requiredPrincipal) {
        return true
    }
    const requiredId = identities[requiredPrincipal]
    const myId = identities[myPrincipal]
    return (
        myId.role.mspId === requiredId.role.mspId &&
        requiredId.role.name === "member"
    )
}

function makeKey(mspId, name) {
    return `${mspId}_${name}`
}

function makeIdentityFromKey(key) {
    const [mspId, name] = key.split("_")
    return {
        role: {
            mspId,
            name
        }
    }
}

/**
 * Picks peers from a larger set that satisfy an endorsement policy
 * @param peers the larger set of peers to pick from
 * @param policy the endorsment policy to satisfy
 * @returns An array of Peers that satisfy the policy
 */
export default function pickPeersForPolicy(
    peers: Array<Peer>,
    policy: Policy
): Array<Peer> {
    const availableMap = {}
    peers.forEach(peer => {
        const role = peer.getRole()
        const idKey = makeKey(peer.getMspId(), role)
        if (typeof availableMap[idKey] === "undefined") {
            availableMap[idKey] = 1
        } else {
            availableMap[idKey] += 1
        }
    })
    const available = policy.identities.map(
        ({ role: { mspId, name } }) => availableMap[makeKey(mspId, name)] || 0
    )

    const availableKeys = Object.keys(availableMap)
    const requiredKeys = policy.identities.map(({ role: { mspId, name } }) =>
        makeKey(mspId, name)
    )
    const remainingKeys = _.difference(availableKeys)(requiredKeys)

    let identities
    if (remainingKeys.length === 0) {
        identities = policy.identities
    } else {
        identities = _.clone(policy.identities)
        remainingKeys.forEach(key => {
            available.push(availableMap[key])
            identities.push(makeIdentityFromKey(key))
        })
    }

    const { valid, requiredPrincipals } = wrangleTreeForReqs(
        policy.policy,
        available,
        makeValidatorForIdentities(identities)
    )

    if (!valid) {
        throw new Error("Error, supplied peers cannot match policy")
    }

    const idKeyPeerListMap = {}
    peers.forEach(peer => {
        const role = peer.getRole()
        const idKey = makeKey(peer.getMspId(), role)
        if (!idKeyPeerListMap[idKey]) {
            idKeyPeerListMap[idKey] = []
        }
        idKeyPeerListMap[idKey].push(peer)
    })
    let peerList = []
    requiredPrincipals.forEach((requiredNum, index) => {
        if (requiredNum > 0) {
            const { name, mspId } = identities[index].role
            const availablePeersForId = idKeyPeerListMap[makeKey(mspId, name)]
            peerList = peerList.concat(
                availablePeersForId.slice(0, requiredNum)
            )
        }
    })
    return peerList
}
