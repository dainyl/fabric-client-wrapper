import fs from "fs"
import { expect } from "chai"
import wrangleTreeForReqs from "./wrangleTreeForReqs"

const makeValidatorForIdentities = identities => myPrincipal => requiredPrincipal => {
    if (myPrincipal === requiredPrincipal) {
        return true
    }
    const myId = identities[myPrincipal]
    const requiredId = identities[requiredPrincipal]
    return (
        myId.role.mspId === requiredId.role.mspId &&
        requiredId.role.name === "member"
    )
}

describe("wrangleTreeForReqs", function() {
    let endorsementPolicy
    const available = [5, 2, 2]

    before(function() {
        endorsementPolicy = JSON.parse(
            fs.readFileSync(
                "test/fixtures/endorsement-policies/test-policy.json"
            )
        )
    })

    it("should return a valid set of principals that satisfy a policy", function() {
        const result = wrangleTreeForReqs(
            endorsementPolicy.policy,
            available,
            makeValidatorForIdentities(endorsementPolicy.identities)
        )
        expect(result).to.be.a("object")
        expect(result.valid).to.be.true
        expect(result.requiredPrincipals).to.deep.equal([4, 2, 1])
    })
})
