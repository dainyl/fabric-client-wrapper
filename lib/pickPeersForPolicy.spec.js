// /**

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
        const expectedReturnedPeers = [
            { ...peer3, id: 1 },
            { ...peer2, id: 2 },
            { ...peer2, id: 3 },
            { ...peer1, id: 4 },
            { ...peer1, id: 5 },
            { ...peer1, id: 6 },
            { ...peer1, id: 7 }
        ]
        const expectedIgnoredPeers = [{ ...peer3, id: 8 }, { ...peer4, id: 9 }]
        const peers = expectedReturnedPeers.concat(expectedIgnoredPeers)
        const result = pickPeersForPolicy(peers, endorsementPolicy)
        const sortedResult = result.slice(0).sort((a, b) => a.id - b.id)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)
        expect(sortedResult).to.deep.equal(expectedReturnedPeers)
    })

    it("should return a valid set for a mix of member/admin peers and member policy", function() {
        const expectedReturnedPeers = [
            { ...peer3, id: 1 },
            { ...peer2, id: 2 },
            { ...peer2Admin, id: 3 },
            { ...peer1, id: 4 },
            { ...peer1, id: 5 },
            { ...peer1Admin, id: 6 },
            { ...peer1Admin, id: 7 }
        ]
        const expectedIgnoredPeers = [
            { ...peer3Admin, id: 8 },
            { ...peer4, id: 9 }
        ]
        const peers = expectedReturnedPeers.concat(expectedIgnoredPeers)
        const result = pickPeersForPolicy(peers, endorsementPolicy)
        const sortedResult = result.slice(0).sort((a, b) => a.id - b.id)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)
        expect(sortedResult).to.deep.equal(expectedReturnedPeers)
    })

    it("should return a valid set for admin peers and member policy", function() {
        const expectedReturnedPeers = [
            { ...peer3, id: 1 },
            { ...peer2, id: 2 },
            { ...peer2Admin, id: 3 },
            { ...peer1, id: 4 },
            { ...peer1, id: 5 },
            { ...peer1Admin, id: 6 },
            { ...peer1Admin, id: 7 }
        ]
        const expectedIgnoredPeers = [
            { ...peer3Admin, id: 8 },
            { ...peer4, id: 9 }
        ]
        const peers = expectedReturnedPeers.concat(expectedIgnoredPeers)
        const result = pickPeersForPolicy(peers, endorsementPolicy)
        const sortedResult = result.slice(0).sort((a, b) => a.id - b.id)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)
        expect(sortedResult).to.deep.equal(expectedReturnedPeers)
    })

    it("should return a valid set for admin peers and admin policy", function() {
        const expectedReturnedPeers = [
            { ...peer3Admin, id: 1 },
            { ...peer2Admin, id: 2 },
            { ...peer2Admin, id: 3 },
            { ...peer1Admin, id: 4 },
            { ...peer1Admin, id: 5 },
            { ...peer1Admin, id: 6 },
            { ...peer1Admin, id: 7 }
        ]
        const expectedIgnoredPeers = [
            { ...peer3Admin, id: 8 },
            { ...peer4Admin, id: 9 }
        ]
        const peers = expectedReturnedPeers.concat(expectedIgnoredPeers)
        const result = pickPeersForPolicy(peers, adminEndorsementPolicy)
        const sortedResult = result.slice(0).sort((a, b) => a.id - b.id)
        expect(result).to.be.a("array")
        expect(result.length).to.equal(7)
        expect(sortedResult).to.deep.equal(expectedReturnedPeers)
    })

    it("should fail if the peers are unable to satisfy the policy", function() {
        const peers = [{ ...peer1, id: "a" }]
        expect(() => pickPeersForPolicy(peers, endorsementPolicy)).to.throw(
            Error,
            "cannot match policy"
        )
    })
})
