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

import FabricClient from "fabric-client"
import User from "fabric-client/lib/User"
import type { CryptoSuite, KeyValueStore } from "fabric-client/lib/api"
import type { UserKeyConfig, EnrollmentConfig } from "./shared"
import UserClient, { type CARegisterOpts } from "./UserClient"
import type { FabricCAClient } from "./FABRIC_CA_FLOW_TYPES"

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

type CreateUserClientBaseOpts = {
    mspId: string,
    cryptoSuite: CryptoSuite,
    store: KeyValueStore,
    roles?: Array<string>
}

export type CreateUserClientFromKeysOpts = CreateUserClientBaseOpts & {
    userKeyConfig: UserKeyConfig
}
/**
 * Creates a new UserClient from a public private key pair
 * @param userKeyConfig - The username of the user + the public private key pair
 * @param organizationConfig - The config of the organization that the user belongs to
 * @param [roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function createUserClientFromKeys({
    userKeyConfig,
    mspId,
    cryptoSuite,
    store,
    roles
}: CreateUserClientFromKeysOpts): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(cryptoSuite)
    if (store) {
        client.setStateStore(store)
    }

    const key = await cryptoSuite.importKey(
        userKeyConfig.cryptoContent.privateKeyPEM,
        {
            ephemeral: !cryptoSuite._cryptoKeyStore // eslint-disable-line no-underscore-dangle
        }
    )

    await addUserToClient(
        client,
        userKeyConfig.username,
        mspId,
        cryptoSuite,
        store,
        key,
        userKeyConfig.cryptoContent.signedCertPEM
    )
    return new UserClient({
        client,
        mspId,
        cryptoSuite,
        store,
        roles
    })
}

export type createUserClientFromCAEnrollOpts = CreateUserClientBaseOpts & {
    fabricCAClient: FabricCAClient,
    enrollmentConfig: EnrollmentConfig
}

/**
 * Creates a new UserClient from enrolling in the CA
 * @param fabricCAClient - The FabricCAClient to use to interact with the CA
 * @param enrollmentConfig - A username+secret pair to enroll with
 * @param {string} enrollmentConfig.username - The username to enroll with
 * @param {string} enrollmentConfig.secret - The secret to enroll with
 * @param organizationConfig - The config of the organization that the user belongs to
 * @param [roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function createUserClientFromCAEnroll({
    fabricCAClient,
    enrollmentConfig: { username, secret },
    mspId,
    cryptoSuite,
    store,
    roles
}: createUserClientFromCAEnrollOpts): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(cryptoSuite)
    if (store) {
        client.setStateStore(store)
    }
    const enrollment = await fabricCAClient.enroll({
        enrollmentID: username,
        enrollmentSecret: secret
    })

    await addUserToClient(
        client,
        username,
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
        enrollmentSecret: secret,
        fabricCAClient
    })
}

type CreateUserClientPredoneBase = {
    mspId?: string,
    cryptoSuite?: CryptoSuite,
    store?: KeyValueStore,
    roles?: Array<string>
}

type CreateUserClientFromCARegisterAndEnrollOpts = CreateUserClientPredoneBase & {
    userClient: UserClient,
    username: string,
    affiliation: string,
    registerOpts?: CARegisterOpts
}

/**
 * Creates a new UserClient from registering and enrolling in the CA
 * @param caAdminUserClient - The UserClient you wish to use to enroll
 * @param username - The username of the new user
 * @param affiliation - The affiliation of the new user
 * @param [opts] - The CA register options
 * @param [roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function createUserClientFromCARegisterAndEnroll({
    userClient,
    mspId,
    cryptoSuite,
    store,
    roles,
    username,
    affiliation,
    registerOpts
}: CreateUserClientFromCARegisterAndEnrollOpts) {
    const secret = await userClient.registerUserInCA(
        username,
        affiliation,
        registerOpts
    )
    return createUserClientFromCAEnroll({
        fabricCAClient: userClient.getFabricCAClient(),
        enrollmentConfig: { username, secret },
        mspId: mspId || userClient.getMspId(),
        cryptoSuite: cryptoSuite || userClient.getCryptoSuite(),
        store: store || userClient.getStore(),
        roles
    })
}

export type CreateUserClientFromStoreOpts = CreateUserClientPredoneBase & {
    userClient?: UserClient,
    username: string
}

/**
 * Creates a new UserClient from the key value store
 * @param username - The username of the new user
 * @param [opts={}] - An array containing the roles that the user has
 * @param {UserClient} [opts.userClient] - The UserClient to use to retrieve the user from the store
 * @param {OrganizationConfig} [opts.organizationConfig] - The OrganizationConfig to use, Note required if UserClient is not specfied
 * @param {Array<string>} [opts.roles] - An array containing the roles that the user has
 * @returns A promise containing a new UserClient instance
 */
export async function createUserClientFromStore({
    userClient,
    username,
    mspId,
    cryptoSuite,
    store,
    roles
}: CreateUserClientFromStoreOpts): Promise<UserClient> {
    const fabricClient = new FabricClient()
    if (!(cryptoSuite && store) && !userClient) {
        throw new Error(
            "createUserClientFromStore requires either store+cryptoSuite or userClient"
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
