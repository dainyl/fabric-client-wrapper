const subtractReqs = (reqs1, reqs2) => {
    const reqs = reqs1.slice(0)
    reqs2.forEach((number, index) => {
        reqs[index] ? (reqs[index] -= number) : (reqs[index] = -number)
    })
    return reqs
}

// the recursive part of the branch func
const accPolicyBranch = (policyFuncs, acc, { valid, set }) => ({
    policyFuncs: policyFuncs.slice(1),
    set,
    acc: valid ? acc - 1 : acc
})
const recurseOnPolicy = ({ policyFuncs, set, acc }) =>
    acc <= 0 || policyFuncs.length < acc
        ? { valid: acc <= 0, set } // we're done, move on!
        : recurseOnPolicy(
              accPolicyBranch(policyFuncs, acc, policyFuncs[0](set))
          ) // keep going

// sets up the function to recurse on
const compilePolicyBranchFunc = (policyFuncs, number) => set =>
    recurseOnPolicy({ policyFuncs, set, acc: number })
// compiles the child policies of the branch and feeds them into the recursive part
const compilePolicyBranch = ({ policies, number }, makeValidator) =>
    compilePolicyBranchFunc(policies.map(p => compilePolicyTree(p, makeValidator)), number) // eslint-disable-line

// given an index, respond with whether it's valid, and the set of signatures left
const respond = (set, index) => {
    if (index < 0) {
        return { valid: false, set }
    }
    const setClone = set.slice(0)
    setClone[index] -= 1
    return { valid: true, set: setClone }
}

// returns a function that evaluates a 'leaf node' of the policy tree
const compilePolicyLeaf = validate => set =>
    respond(
        set,
        set.findIndex((number, signature) => number > 0 && validate(signature))
    )

// returns a function that evaluates the validity of a signature set
const compilePolicyTree = (policy, makeValidator) => {
    if (typeof policy["signed-by"] !== "undefined") {
        return compilePolicyLeaf(makeValidator(policy["signed-by"]))
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
    const { valid, set } = ev(available)
    if (valid) {
        return {
            valid,
            requiredPrincipals: Object.values(subtractReqs(available, set))
        }
    }
    return { valid }
}

export default wrangleTreeForReqs
