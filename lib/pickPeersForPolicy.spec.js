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

import { expect } from "chai"
import fs from "fs"
import pickPeersForPolicy from "./pickPeersForPolicy"

function createPeerStub(mspId, role) {
    return {
        getMspId() {
            return mspId
        },
        getRole() {
            return role
        }
    }
}

const peer1 = createPeerStub("peerOrg1", "member")
const peer1Admin = createPeerStub("peerOrg1", "admin")
const peer2 = createPeerStub("peerOrg2", "member")
const peer2Admin = createPeerStub("peerOrg2", "admin")
const peer3 = createPeerStub("ordererOrg", "member")
const peer3Admin = createPeerStub("ordererOrg", "admin")
const peer4 = createPeerStub("test", "member")
const peer4Admin = createPeerStub("test", "admin")

describe("pickPeersForPolicy", function() {
    let endorsementPolicy
    let adminEndorsementPolicy

    before(function() {
        endorsementPolicy = JSON.parse(
            fs.readFileSync(
                "test/fixtures/endorsement-policies/test-policy.json"
            )
        )
        adminEndorsementPolicy = JSON.parse(
            fs.readFileSync(
                "test/fixtures/endorsement-policies/test-policy-admin.json"
            )
        )
    })

    it("should return a valid set for member peers and member policy", function() {
        const peers = [
            { ...peer3, id: "g" },
            { ...peer3, id: "h" },
            { ...peer2, id: "e" },
            { ...peer2, id: "f" },
            { ...peer4, id: "i" },
            { ...peer1, id: "a" },
            { ...peer1, id: "b" },
            { ...peer1, id: "c" },
            { ...peer1, id: "d" }
        ]

        const result = pickPeersForPolicy(peers, endorsementPolicy)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)

        // 4 from peerOrg1
        expect(result[0].id).to.equal("a")
        expect(result[1].id).to.equal("b")
        expect(result[2].id).to.equal("c")
        expect(result[3].id).to.equal("d")

        // 2 from peerOrg2
        expect(result[4].id).to.equal("e")
        expect(result[5].id).to.equal("f")

        // 1 from ordererOrg
        expect(result[6].id).to.equal("g")
    })

    it("should return a valid set for a mix of member/admin peers and member policy", function() {
        const peers = [
            { ...peer3, id: "d" },
            { ...peer3Admin, id: "h" },
            { ...peer2, id: "c" },
            { ...peer2Admin, id: "g" },
            { ...peer4, id: "i" },
            { ...peer1, id: "a" },
            { ...peer1, id: "b" },
            { ...peer1Admin, id: "e" },
            { ...peer1Admin, id: "f" }
        ]

        const result = pickPeersForPolicy(peers, endorsementPolicy)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)

        // 4 from peerOrg1
        expect(result[0].id).to.equal("a")
        expect(result[1].id).to.equal("b")
        expect(result[2].id).to.equal("c")
        expect(result[3].id).to.equal("d")

        // 2 from peerOrg2
        expect(result[4].id).to.equal("e")
        expect(result[5].id).to.equal("f")

        // 1 from ordererOrg
        expect(result[6].id).to.equal("g")
    })

    it("should return a valid set for admin peers and member policy", function() {
        const peers = [
            { ...peer3Admin, id: "g" },
            { ...peer3Admin, id: "h" },
            { ...peer2Admin, id: "e" },
            { ...peer2Admin, id: "f" },
            { ...peer4Admin, id: "i" },
            { ...peer1Admin, id: "a" },
            { ...peer1Admin, id: "b" },
            { ...peer1Admin, id: "c" },
            { ...peer1Admin, id: "d" }
        ]

        const result = pickPeersForPolicy(peers, endorsementPolicy)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)

        // 4 from peerOrg1
        expect(result[0].id).to.equal("a")
        expect(result[1].id).to.equal("b")
        expect(result[2].id).to.equal("c")
        expect(result[3].id).to.equal("d")

        // 2 from peerOrg2
        expect(result[4].id).to.equal("e")
        expect(result[5].id).to.equal("f")

        // 1 from ordererOrg
        expect(result[6].id).to.equal("g")
    })

    it("should return a valid set for admin peers and admin policy", function() {
        const peers = [
            { ...peer3Admin, id: "g" },
            { ...peer3Admin, id: "h" },
            { ...peer2Admin, id: "e" },
            { ...peer2Admin, id: "f" },
            { ...peer4Admin, id: "i" },
            { ...peer1Admin, id: "a" },
            { ...peer1Admin, id: "b" },
            { ...peer1Admin, id: "c" },
            { ...peer1Admin, id: "d" }
        ]

        const result = pickPeersForPolicy(peers, adminEndorsementPolicy)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)

        // 4 from peerOrg1
        expect(result[0].id).to.equal("a")
        expect(result[1].id).to.equal("b")
        expect(result[2].id).to.equal("c")
        expect(result[3].id).to.equal("d")

        // 2 from peerOrg2
        expect(result[4].id).to.equal("e")
        expect(result[5].id).to.equal("f")

        // 1 from ordererOrg
        expect(result[6].id).to.equal("g")
    })

    it("should fail if the peers are unable to satisfy the policy", function() {
        const peers = [{ ...peer1, id: "a" }]
        expect(() => pickPeersForPolicy(peers, endorsementPolicy)).to.throw(
            Error,
            "cannot match policy"
        )
    })
})
