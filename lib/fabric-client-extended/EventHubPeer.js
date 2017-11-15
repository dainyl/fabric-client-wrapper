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

import type FabricClient from "fabric-client"
import type Peer from "fabric-client/lib/Peer"
import EventHub from "fabric-client/lib/EventHub"
import type { ConnectionOpts } from "../FABRIC_FLOW_TYPES"
import type UserClient from "../UserClient"
import EventHubManager from "../EventHubManager"
import {
    isFcwPeer,
    upgradePeerToFcwPeer,
    createFcwPeer,
    type FcwPeerOpts,
    type CreateFcwPeerOpts
} from "./FcwPeer"

type EventHubPeerOptsPartial = {
    client: FabricClient | UserClient,
    eventUrl: string,
    eventHubOpts: ConnectionOpts
}

export type EventHubPeerOpts = FcwPeerOpts & EventHubPeerOptsPartial
export type CreateEventHubPeerOpts = CreateFcwPeerOpts & EventHubPeerOptsPartial

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

export function upgradeFcwPeerToEventHubPeer(
    fcwPeer: Peer,
    { client, eventUrl, eventHubOpts }: EventHubPeerOpts
) {
    const eventHub = client.client
        ? new EventHub(client.client)
        : new EventHub(client)
    eventHub.setPeerAddr(eventUrl, eventHubOpts)
    fcwPeer.eventHubManager = new EventHubManager(eventHub)

    fcwPeer.getEventHubManager = () => fcwPeer.eventHubManager
    fcwPeer.canConnect = (timeout = 60000) =>
        new Promise(resolve => {
            let blockRegistrationNumber
            const handle = setTimeout(() => {
                fcwPeer.eventHubManager.unregisterBlockEvent(
                    blockRegistrationNumber
                )
                resolve(false)
            }, timeout)
            blockRegistrationNumber = fcwPeer.eventHubManager.registerBlockEvent(
                () => {},
                () => {
                    clearTimeout(handle)
                    fcwPeer.eventHubManager.unregisterBlockEvent(
                        blockRegistrationNumber
                    )
                    resolve(false)
                }
            )
            fcwPeer.eventHubManager
                .waitEventHubConnected(timeout)
                .then(() => {
                    clearTimeout(handle)
                    fcwPeer.eventHubManager.unregisterBlockEvent(
                        blockRegistrationNumber
                    )
                    resolve(true)
                })
                .catch(() => {
                    clearTimeout(handle)
                    fcwPeer.eventHubManager.unregisterBlockEvent(
                        blockRegistrationNumber
                    )
                    resolve(false)
                })
        })
    return fcwPeer
}

export function upgradePeerToEventHubPeer(
    peer: Peer,
    eventHubPeerOpts: EventHubPeerOpts
) {
    return upgradeFcwPeerToEventHubPeer(
        upgradePeerToFcwPeer(peer, eventHubPeerOpts),
        eventHubPeerOpts
    )
}

export function createEventHubPeer(
    createEventHubPeerOpts: CreateEventHubPeerOpts
) {
    const fcwPeer = createFcwPeer(createEventHubPeerOpts)
    return upgradeFcwPeerToEventHubPeer(fcwPeer, createEventHubPeerOpts)
}

export function isEventHubPeer(obj: any) {
    return isFcwPeer(obj) && obj.getEventHubManager
}
