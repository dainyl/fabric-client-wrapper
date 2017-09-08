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

const subtractReqs = (reqs1, reqs2) => {
    const reqs = { ...reqs1 }
    Object.entries(reqs2).forEach(([rk, rv]) => {
        reqs[rk] ? (reqs[rk] -= rv) : (reqs[rk] = -rv)
    })
    return reqs
}

const toArr = obj =>
    Object.entries(obj).reduce((acc, [id, number]) => acc.concat(Array(number).fill(parseInt(id, 10))), [])
const fromArr = arr => arr.reduce((acc, x) => ({ ...acc, [x]: acc[x] ? acc[x] + 1 : 1 }), {})

// the recursive part of the branch func
const accPolicyBranch = (policyFuncs, acc, { valid, set }) => ({
    policyFuncs: policyFuncs.slice(1),
    set,
    acc: valid ? acc - 1 : acc,
})
const recurseOnPolicy = ({ policyFuncs, set, acc }) =>
    acc <= 0 || policyFuncs.length < acc
        ? { valid: acc <= 0, set } // we're done, move on!
        : recurseOnPolicy(accPolicyBranch(policyFuncs, acc, policyFuncs[0](set))) // keep going

// sets up the function to recurse on
const compilePolicyBranchFunc = (policyFuncs, number) => set => recurseOnPolicy({ policyFuncs, set, acc: number })
// compiles the child policies of the branch and feeds them into the recursive part
const compilePolicyBranch = ({ policies, number }, makeValidator) =>
    compilePolicyBranchFunc(policies.map(p => compilePolicyTree(p, makeValidator)), number) // eslint-disable-line

// given an index, respond with whether it's valid, and the set of signatures left
const respond = (set, index) =>
    index >= 0 ? { valid: true, set: set.slice(0, index).concat(set.slice(index + 1)) } : { valid: false, set }
// returns a function that evaluates a 'leaf node' of the policy tree
const compilePolicyLeaf = validate => set => respond(set, set.findIndex(signature => validate(signature)))

// returns a function that evaluates the validity of a signature set
const compilePolicyTree = (policy, makeValidator) => {
    if (typeof policy['signed-by'] !== 'undefined') {
        return compilePolicyLeaf(makeValidator(policy['signed-by']))
    }
    const key = Object.keys(policy)[0]
    const number = key.match(/^(\d+)-of$/)[1]
    return compilePolicyBranch({ number, policies: policy[key] }, makeValidator)
}

// checks if available is valid
// if valid, returns the set required to satisfy
// if invalid, returns just {valid: false}
const wrangleTreeForReqs = (policy, available, makeValidator) => {
    const ev = compilePolicyTree(policy, makeValidator)
    const { valid, set } = ev(toArr(available))
    if (valid) {
        return {
            valid,
            requiredPrincipals: Object.values(subtractReqs(available, fromArr(set))),
        }
    }
    return { valid }
}

export default wrangleTreeForReqs
