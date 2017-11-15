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
import wrangleTreeForReqs from "./wrangleTreeForReqs"

const endorsementPolicy = {
    identities: [
        { role: { name: "member", mspId: "peerOrg1" } },
        { role: { name: "member", mspId: "peerOrg2" } },
        { role: { name: "admin", mspId: "ordererOrg" } }
    ],
    policy: {
        "2-of": [
            {
                "2-of": [
                    { "signed-by": 1 },
                    {
                        "2-of": [{ "signed-by": 0 }, { "signed-by": 0 }]
                    },
                    { "signed-by": 2 }
                ]
            },
            {
                "4-of": [
                    { "signed-by": 1 },
                    { "signed-by": 1 },
                    { "signed-by": 0 },
                    { "signed-by": 0 },
                    { "signed-by": 2 }
                ]
            }
        ]
    }
}

const available = [5, 2, 2]

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
