// @flow
/* eslint import/prefer-default-export: 0 */

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
