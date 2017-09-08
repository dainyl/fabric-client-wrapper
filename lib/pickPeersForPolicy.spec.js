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

import { expect } from 'chai'
import fs from 'fs'
import pickPeersForPolicy from './pickPeersForPolicy'

const peer1 = {
    getRole() {
        return 'member'
    },
    getMspId() {
        return 'peerOrg1'
    },
}

const peer2 = {
    getRole() {
        return 'member'
    },
    getMspId() {
        return 'peerOrg2'
    },
}

const peer3 = {
    getRole() {
        return 'admin'
    },
    getMspId() {
        return 'ordererOrg'
    },
}
const peers = [
    { ...peer1, id: 'a' },
    { ...peer1, id: 'b' },
    { ...peer1, id: 'c' },
    { ...peer1, id: 'd' },
    { ...peer1, id: 'e' },
    { ...peer2, id: 'f' },
    { ...peer2, id: 'g' },
    { ...peer3, id: 'h' },
    { ...peer3, id: 'i' },
]

describe('pickPeersForPolicy', function() {
    let endorsementPolicy

    before(function() {
        endorsementPolicy = JSON.parse(fs.readFileSync('test/fixtures/endorsement-policies/test-policy.json'))
    })

    it('should return a valid set of peers that satisfy a policy', function() {
        const result = pickPeersForPolicy(peers, endorsementPolicy)
        expect(result).to.be.a('array')
        expect(result.length).to.equal(7)

        // 4 from peerOrg1
        expect(result[0].id).to.equal(peers[0].id)
        expect(result[1].id).to.equal(peers[1].id)
        expect(result[2].id).to.equal(peers[2].id)
        expect(result[3].id).to.equal(peers[3].id)

        // 2 from peerOrg2
        expect(result[4].id).to.equal(peers[5].id)
        expect(result[5].id).to.equal(peers[6].id)

        // 1 from ordererOrg
        expect(result[6].id).to.equal(peers[7].id)
    })
})
