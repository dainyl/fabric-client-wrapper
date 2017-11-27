// @flow
/* eslint import/prefer-default-export: 0 */
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
import FileKeyValueStore from "fabric-client/lib/impl/FileKeyValueStore"
import type { CryptoStore } from "./shared"

/**
 * A set of objects and configuration used by/representing the organization
 * @typedef {Object} CryptoStore
 * @property {CryptoSuite} cryptoSuite - An abstraction over crytpographic algorithms
 * @property {KeyValueStore} store - A key value store used to store user credentials
 */

/**
 * Creates a new OrganizationConfig that's based on a file based key value store
 * @param keyValueStorePath - a path that will be used for the key value store
 * @returns an object holding information about a organization
 */
export async function newFileKeyValueStoreAndCryptoSuite(
    keyValueStorePath: string
): Promise<CryptoStore> {
    const cryptoSuite = FabricClient.newCryptoSuite()
    cryptoSuite.setCryptoKeyStore(
        FabricClient.newCryptoKeyStore(FileKeyValueStore, {
            path: keyValueStorePath
        })
    )
    const store = await new FileKeyValueStore({
        path: keyValueStorePath
    })
    return {
        cryptoSuite,
        store
    }
}

/**
 * Creates a new OrganizationConfig that's based on a CouchDB key value store
 * @param url - The CouchDB instance url, in the form of http(s)://:@host:port
 * @param [dbName='member_db'] - Identifies the name of the database to use.
 * @returns an object holding information about a organization
 */
export async function newCouchDBKeyValueStoreAndCryptoSuite(
    url: string,
    dbName: ?string
): Promise<CryptoStore> {
    const CouchDBKeyValueStore = require("fabric-client/lib/impl/CouchDBKeyValueStore") // eslint-disable-line
    const cryptoSuite = FabricClient.newCryptoSuite()
    cryptoSuite.setCryptoKeyStore(
        FabricClient.newCryptoKeyStore(CouchDBKeyValueStore, {
            url,
            name: dbName
        })
    )
    const store = await new CouchDBKeyValueStore({ url, name: dbName })
    return {
        cryptoSuite,
        store
    }
}
