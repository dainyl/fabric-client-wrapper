// @flow
/* eslint import/prefer-default-export: 0 */

import type { CryptoSuite, KeyValueStore } from "fabric-client/lib/api"

export type CryptoStore = {
    cryptoSuite: CryptoSuite,
    store: KeyValueStore
}

export const ADMIN_ROLE = "admin"
export const CA_ADMIN_ROLE = "ca_admin"
export const MEMBER_ROLE = "member"
