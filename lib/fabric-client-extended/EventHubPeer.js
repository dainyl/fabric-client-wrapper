// @flow

import type FabricClient from "fabric-client"
import type Peer from "fabric-client/lib/Peer"
import EventHub from "fabric-client/lib/EventHub"
import type { ConnectionOpts } from "../FABRIC_FLOW_TYPES"
import type UserClient from "../UserClient"
import EventHubManager from "../EventHubManager"
import {
    isFcwPeer,
    upgradePeerToFcwPeer,
    newFcwPeer,
    type FcwPeerOpts,
    type NewFcwPeerOpts
} from "./FcwPeer"

type EventHubPeerOptsPartial = {
    client: FabricClient | UserClient,
    eventUrl: string,
    eventHubOpts: ConnectionOpts
}

export type EventHubPeerOpts = FcwPeerOpts & EventHubPeerOptsPartial
export type NewEventHubPeerOpts = NewFcwPeerOpts & EventHubPeerOptsPartial

/**
 * A fabric-client Peer with additional MSP information and an EventHubManager
 * @typedef {Object} EventHubPeer
 * @augments FcwPeer
 */

/**
 * Upgrades a FcwPeer with an EventHubManager
 * @param {Peer} fcwPeer
 * @param opts - The options for upgrading the FcwPeer
 * @param {FabricClient|UserClient} opts.client - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} opts.eventUrl - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} opts.eventHubOpts - The options for connecting to the peers event url
 * @returns {EventHubPeer} The EventHubPeer
 */
export function upgradeFcwPeerToEventHubPeer(
    fcwPeer: Peer,
    { client, eventUrl, eventHubOpts }: EventHubPeerOpts
): Peer {
    const eventHub = client.client
        ? new EventHub(client.client)
        : new EventHub(client)
    eventHub.setPeerAddr(eventUrl, eventHubOpts)
    fcwPeer.eventHubManager = new EventHubManager(eventHub)

    /**
     * Gets the Peer's EventHubManager
     * @typedef getEventHubManager
     * @memberof EventHubPeer#
     * @returns {EventHubManager} The Peer's EventHubManager
     */
    fcwPeer.getEventHubManager = () => fcwPeer.eventHubManager

    /**
     * Checks whether the peer can currently correct
     * @typedef canConnect
     * @memberof EventHubPeer#
     * @returns {Promise<boolean>} true if the peer can connect, false otherwisek
     */
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

/**
 * Upgrades a fabric-client Peer with additional MSP information and an EventHubManager
 * @param {Peer} peer
 * @param opts - The options for upgrading the Peer
 * @param {string} opts.mspId - The MSP ID of the organization the peer belongs to
 * @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
 * @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
 * @param {FabricClient|UserClient} opts.client - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} opts.eventUrl - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} opts.eventHubOpts - The options for connecting to the peers event url
 * @returns {EventHubPeer} The EventHubPeer
 */
export function upgradePeerToEventHubPeer(
    peer: Peer,
    opts: EventHubPeerOpts
): Peer {
    return upgradeFcwPeerToEventHubPeer(upgradePeerToFcwPeer(peer, opts), opts)
}

/**
 * Creates a fabric-client Peer with additional MSP information and an EventHubManager
 * @param opts - The options for creating the EventhHubPeer
 * @param {string} opts.requestUrl - The URL to issue requests to the Peer with
 * @param {ConnectionOpts} opts.peerOpts - The options for connecting to the peer's request url
 * @param {string} opts.mspId - The MSP ID of the organization the peer belongs to
 * @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
 * @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
 * @param {FabricClient|UserClient} opts.client - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} opts.eventUrl - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} opts.eventHubOpts - The options for connecting to the peers event url
 * @returns {EventHubPeer} The EventHubPeer
 */
export function newEventHubPeer(opts: NewEventHubPeerOpts): Peer {
    const fcwPeer = newFcwPeer(opts)
    return upgradeFcwPeerToEventHubPeer(fcwPeer, opts)
}

/**
 * Checks whether an object is a EventHubPeer
 * @param obj - The object to check
 * @returns true if the object is a EventHubPeer, false otherwise
 */
export function isEventHubPeer(obj: any): boolean {
    return isFcwPeer(obj) && obj.getEventHubManager
}
