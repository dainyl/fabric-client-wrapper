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

import FabricClient from 'fabric-client'
import type FabricCAClient from 'fabric-ca-client'
import User from 'fabric-client/lib/User'
import type { UserKeyConfig, EnrollmentConfig, OrganizationConfig } from './shared'
import UserClient, { type CARegisterOpts } from './UserClient'

/**
* Creates a new UserClient from a public private key pair
* @param userKeyConfig - The username of the user + the public private key pair
* @param organizationConfig - The config of the organization that the user belongs to
* @param [roles] - An array containing the roles that the user has
* @returns A promise containing a new UserClient instance
*/
export async function createUserClientFromKeys(
    userKeyConfig: UserKeyConfig,
    organizationConfig: OrganizationConfig,
    roles?: Array<string>
): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(organizationConfig.cryptoSuite)
    client.setStateStore(organizationConfig.store)
    await client.createUser({
        ...userKeyConfig,
        mspid: organizationConfig.mspId,
    })
    return new UserClient(client, organizationConfig, roles)
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
export async function createUserClientFromCAEnroll(
    fabricCAClient: FabricCAClient,
    { username, secret }: EnrollmentConfig,
    organizationConfig: OrganizationConfig,
    roles?: Array<string>
): Promise<UserClient> {
    const client = new FabricClient()
    client.setCryptoSuite(organizationConfig.cryptoSuite)
    client.setStateStore(organizationConfig.store)
    const enrollment = await fabricCAClient.enroll({
        enrollmentID: username,
        enrollmentSecret: secret,
    })
    const user = new User(username)
    user.setCryptoSuite(client.getCryptoSuite())
    await user.setEnrollment(enrollment.key, enrollment.certificate, organizationConfig.mspId)
    await client.setUserContext(user)
    const userClient = new UserClient(client, organizationConfig, roles)
    userClient.setEnrollmentSecret(secret)
    userClient.setFabricCAClient(fabricCAClient)
    return userClient
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
export async function createUserClientFromCARegisterAndEnroll(
    caAdminUserClient: UserClient,
    username: string,
    affiliation: string,
    opts?: CARegisterOpts,
    roles?: Array<string>
): Promise<UserClient> {
    const secret = await caAdminUserClient.registerUserInCA(username, affiliation, opts)
    return createUserClientFromCAEnroll(
        caAdminUserClient.getFabricCAClient(),
        { username, secret },
        caAdminUserClient.organizationConfig,
        roles
    )
}

export type CreateUserClientFromStoreOpts = {
    userClient?: UserClient,
    organizationConfig?: OrganizationConfig,
    roles?: Array<string>,
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
export async function createUserClientFromStore(
    username: string,
    { userClient, organizationConfig, roles }: CreateUserClientFromStoreOpts = {}
): Promise<UserClient> {
    const fabricClient = new FabricClient()
    if (!organizationConfig && !userClient) {
        throw new Error('createUserClientFromStore requires either userClient or organizationConfig')
    }
    const orgConfig = organizationConfig || (userClient: any).getOrganizationConfig()
    fabricClient.setCryptoSuite(orgConfig.cryptoSuite)
    fabricClient.setStateStore(orgConfig.store)

    if (userClient) {
        const user = await userClient.client.loadUserFromStateStore(username)
        if (!user) {
            throw new Error(`Could not find user with username ${username}`)
        }
        await fabricClient.setUserContext(user)
    } else {
        const user = await fabricClient.getUserContext(username, true)
        if (!user) {
            throw new Error(`Could not find user with username ${username}`)
        }
    }

    return new UserClient(fabricClient, orgConfig, roles)
}
