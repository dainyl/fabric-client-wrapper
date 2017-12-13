// @flow

import FabricClient from "fabric-client"
import type FabricCAClient from "fabric-ca-client" // eslint-disable-line import/no-extraneous-dependencies
import User from "fabric-client/lib/User"
import type { CryptoSuite, KeyValueStore } from "fabric-client/lib/api"
import type { IdentityPEMs } from "./FABRIC_FLOW_TYPES"
import type { RegisterRequest } from "./FABRIC_CA_FLOW_TYPES"
import UserClient from "./UserClient"

async function addUserToClient(
    client: FabricClient,
    username: string,
    mspId: string,
    cryptoSuite: CryptoSuite,
    store: KeyValueStore,
    key: string,
    certificate: string
) {
    const user = new User(username)
    if (cryptoSuite) {
        user.setCryptoSuite(client.getCryptoSuite())
    }
    await user.setEnrollment(key, certificate, mspId)
    return client.setUserContext(user, !store)
}

type NewUserClientBaseOpts = {
    mspId: string,
    cryptoSuite: CryptoSuite,
    store: KeyValueStore,
    roles?: Array<string>
}

export type NewUserClientFromKeysOpts = NewUserClientBaseOpts & {
    username: string,
    cryptoContent: IdentityPEMs
}
/**
 * Creates a new UserClient from a public private key pair
 * @param opts - The options to create the user with
 * @param {string} opts.username - The username of the user
 * @param {IdentityPEMs} opts.cryptoContent - The public/private key pair for the user
 * @param {string} opts.mspId - The MSP ID that the user belongs to
 * @param {CryptoSuite} opts.cryptoSuite - The CryptoSuite to use to create the user
 * @param {KeyValueStore} [opts.store] - The store to persist the user information in
 * @param {Array<string>} [opts.roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function newUserClientFromKeys({
    username,
    cryptoContent,
    mspId,
    cryptoSuite,
    store,
    roles
}: NewUserClientFromKeysOpts): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(cryptoSuite)
    if (store) {
        client.setStateStore(store)
    }

    const key = await cryptoSuite.importKey(cryptoContent.privateKeyPEM, {
        ephemeral: !cryptoSuite._cryptoKeyStore // eslint-disable-line no-underscore-dangle
    })

    await addUserToClient(
        client,
        username,
        mspId,
        cryptoSuite,
        store,
        key,
        cryptoContent.signedCertPEM
    )
    return new UserClient({
        client,
        mspId,
        cryptoSuite,
        store,
        roles
    })
}

export type NewUserClientFromCAEnrollOpts = NewUserClientBaseOpts & {
    fabricCAClient: FabricCAClient,
    enrollmentID: string,
    enrollmentSecret: string,
    username?: string
}

/**
 * Creates a new UserClient from enrolling in the CA
 * @param opts - The options to create the user with
 * @param {FabricCAClient} opts.fabricCAClient - The FabricCAClient to use to interact with the CA
 * @param {string} opts.enrollmentID - The username to enroll with
 * @param {string} opts.enrollmentSecret - The secret to enroll with
 * @param {string} opts.mspId - The MSP ID that the user belongs to
 * @param {string} [opts.username] - The username to use for the user, defaults to enrollmentID
 * @param {CryptoSuite} opts.cryptoSuite - The CryptoSuite to use to create the user
 * @param {KeyValueStore} [opts.store] - The store to persist the user information in
 * @param {Array<string>} [opts.roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function newUserClientFromCAEnroll({
    fabricCAClient,
    enrollmentID,
    enrollmentSecret,
    username,
    mspId,
    cryptoSuite,
    store,
    roles
}: NewUserClientFromCAEnrollOpts): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(cryptoSuite)
    if (store) {
        client.setStateStore(store)
    }
    const enrollment = await fabricCAClient.enroll({
        enrollmentID,
        enrollmentSecret
    })

    await addUserToClient(
        client,
        username || enrollmentID,
        mspId,
        cryptoSuite,
        store,
        enrollment.key,
        enrollment.certificate
    )

    return new UserClient({
        client,
        mspId,
        cryptoSuite,
        store,
        roles,
        enrollmentSecret,
        fabricCAClient
    })
}

type NewUserClientPredoneBase = {
    mspId?: string,
    cryptoSuite?: CryptoSuite,
    store?: KeyValueStore,
    roles?: Array<string>
}

type NewUserClientFromCARegisterAndEnrollOpts = NewUserClientPredoneBase & {
    userClient: UserClient,
    registerRequest: RegisterRequest,
    username?: string
}

/**
 * Creates a new UserClient from registering and enrolling in the CA
 * @param opts - The options to create the user with
 * @param {UserClient} opts.userClient - The UserClient to register and enroll with
 * @param {string} [opts.mspId] - The MSP ID that the user belongs to. Fallsback to userClient's MSP ID
 * @param {CryptoSuite} opts.cryptoSuite - The CryptoSuite to use to create the user
 * @param {KeyValueStore} [opts.store] - The store to persist the user information in
 * @param {Array<string>} [opts.roles] - An array containing the roles that the user has
 * @param {RegisterRequest} opts.registerRequest - The request arguments to register the user with
 * @param {string} [opts.username] - The username to use for the user, defaults to enrollmentID
 * @returns A promise containing a new UserClient instance
 */
export async function newUserClientFromCARegisterAndEnroll({
    userClient,
    mspId,
    username,
    cryptoSuite,
    store,
    roles,
    registerRequest
}: NewUserClientFromCARegisterAndEnrollOpts) {
    const enrollmentSecret = await userClient.registerUserInCA(registerRequest)
    return newUserClientFromCAEnroll({
        fabricCAClient: userClient.getFabricCAClient(),
        enrollmentID: registerRequest.enrollmentID,
        enrollmentSecret,
        username,
        mspId: mspId || userClient.getMspId(),
        cryptoSuite: cryptoSuite || userClient.getCryptoSuite(),
        store: store || userClient.getStore(),
        roles
    })
}

export type NewUserClientFromStoreOpts = NewUserClientPredoneBase & {
    userClient?: UserClient,
    cryptoSuite?: CryptoSuite,
    username: string
}

/**
 * Creates a new UserClient from the key value store
 * @param opts - The options to create the user with
 * @param {string} opts.username - The username of the user
 * @param {UserClient} [opts.userClient] - The UserClient to use to retrieve the user.
 * @param {CryptoSuite} [opts.cryptoSuite] - The CryptoSuite to use to create the user. Fallsback to the userClient's CryptoSuite
 * @param {KeyValueStore} [opts.store] - The store to persist the user information in. Fallsback to the userClient's KeyValueStore
 * @param {IdentityPEMs} opts.cryptoContent - The public/private key pair for the user
 * @param {string} opts.mspId - The MSP ID that the user belongs to
 * @param {Array<string>} [opts.roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function newUserClientFromStore({
    userClient,
    username,
    mspId,
    cryptoSuite,
    store,
    roles
}: NewUserClientFromStoreOpts): Promise<UserClient> {
    const fabricClient = new FabricClient()
    if (!(cryptoSuite && store) && !userClient) {
        throw new Error(
            "newUserClientFromStore requires either store+cryptoSuite or userClient"
        )
    }
    const myCryptoSuite = cryptoSuite || (userClient: any).getCryptoSuite()
    const myStore = store || (userClient: any).getStore()
    const myMspId = mspId || (userClient: any).getMspId()
    fabricClient.setCryptoSuite(myCryptoSuite)
    fabricClient.setStateStore(myStore)

    if (userClient) {
        const user = await userClient.client.loadUserFromStateStore(username)
        if (!user) {
            throw new Error(`Could not find user with username ${username}`)
        }
        await fabricClient.setUserContext(user, myStore)
    } else {
        const user = await fabricClient.getUserContext(username, true)
        if (!user) {
            throw new Error(`Could not find user with username ${username}`)
        }
    }

    return new UserClient({
        client: fabricClient,
        mspId: myMspId,
        cryptoSuite: myCryptoSuite,
        store: myStore,
        roles
    })
}
