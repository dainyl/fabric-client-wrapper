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

import type FabricClient from 'fabric-client'
import EventHub from 'fabric-client/lib/EventHub'
import type { ConnectionOpts } from '../FABRIC_FLOW_TYPES'
import type { OrganizationConfig } from '../shared'
import type UserClient from '../UserClient'
import FcwPeer from './FcwPeer'
import wait from '../wait'

export type EventHubPeerOpts = {
    client: FabricClient | UserClient,
    requestUrl: string,
    eventUrl: string,
    connectionOpts: ConnectionOpts,
    organizationConfig?: OrganizationConfig,
    mspId?: string,
    adminMspIds?: Array<string>,
    role?: string,
}

/**
* A Peer that contains an EventHub and other additional information
* @param {EventHubPeerOpts} opts - The options for creating the Peer and EventHub
* @param {FabricClient|UserClient} opts.client - The FabricClient/UserClient tied to the user that creates the EventHub
* @param {string} opts.requestUrl - The URL to issue requests to the Peer with
* @param {string} opts.eventUrl - The URL to listen to events from the Peer with
* @param {ConnectionOpts} opts.connectionOpts - The options for connecting to the peers request url
* @param {OrganizationConfig} [opts.organizationConfig] - The configuration of the organization that the Peer belongs to. Required if mspId is not specified.
* @param {string} [opts.mspId] - The MSP ID of the organization the peer belongs to
* @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
* @param {string} [opts.role] - The role of the Peer. Defaults to member
*/
export default class EventHubPeer extends FcwPeer {
    constructor({
        client,
        requestUrl,
        eventUrl,
        connectionOpts,
        organizationConfig,
        mspId,
        adminMspIds,
        role,
    }: EventHubPeerOpts) {
        super({
            requestUrl,
            connectionOpts,
            organizationConfig,
            mspId,
            adminMspIds,
            role,
        })

        this.eventHub = client.client ? new EventHub(client.client) : new EventHub(client)
        this.eventHub.setPeerAddr(eventUrl, connectionOpts)
        this.registerBlockEventHandle = this.eventHub.registerBlockEvent(
            () => {
                this.eventHub.unregisterBlockEvent(this.registerBlockEventHandle)
            },
            error => {
                if (!error.message.includes('EventHub has been shutdown')) {
                    throw error
                }
            }
        )
        this.eventHub.connect()
    }

    /**
    * Waits until the EventHub has been connected
    * @param [timeout=60000] - The maximum amount of time to wait for the EventHub to connect
    */
    async waitEventHubConnected(timeout: number = 60000): Promise<boolean> {
        let endDate = new Date()
        endDate = new Date(endDate.getTime() + timeout)
        while (new Date() < endDate) {
            if (this.eventHub.isconnected()) {
                return true
            }
            await wait(100) // eslint-disable-line no-await-in-loop
        }
        throw new Error('Error timed out while waiting for eventhub')
    }

    /**
    * Gets the underlying EventHub instance
    */
    getEventHub(): EventHub {
        return this.eventHub
    }
}
