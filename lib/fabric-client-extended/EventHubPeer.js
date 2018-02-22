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
    client?: FabricClient | UserClient,
    eventUrl?: string,
    eventHubOpts?: ConnectionOpts,
    eventHubManager?: EventHubManager
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
 * @param {Object} opts - The options for upgrading the FcwPeer or the EventHubManager to use
 * @param {FabricClient|UserClient} [opts.client] - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} [opts.eventUrl] - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} [opts.eventHubOpts] - The options for connecting to the peers event url
 * @param {EventHubManager} [opts.eventHubManager] - The eventHubManager to use, required if eventUrl and eventHubOpts aren't specified
 * @returns {EventHubPeer} The EventHubPeer
 */
export function upgradeFcwPeerToEventHubPeer(
    fcwPeer: Peer,
    opts: EventHubPeerOpts
): Peer {
    let eventHubManager
    if (opts.eventUrl && opts.client) {
        const { eventUrl, eventHubOpts, client } = (opts: any)
        const eventHub = client.client
            ? new EventHub(client.client)
            : new EventHub(client)
        eventHub.setPeerAddr(eventUrl, eventHubOpts)
        eventHubManager = new EventHubManager(eventHub)
    } else if (opts.eventHubManager) {
        eventHubManager = opts.eventHubManager
    } else {
        throw new Error(
            "Error either eventUrl+client or eventHubManager is required"
        )
    }
    fcwPeer.eventHubManager = eventHubManager

    /**
     * Gets the Peer's EventHubManager
     * @typedef getEventHubManager
     * @memberof EventHubPeer#
     * @returns {EventHubManager} The Peer's EventHubManager
     */
    fcwPeer.getEventHubManager = () => fcwPeer.eventHubManager

    return fcwPeer
}

/**
 * Upgrades a fabric-client Peer with additional MSP information and an EventHubManager
 * @param {Peer} peer
 * @param opts - The options for upgrading the Peer
 * @param {string} opts.mspId - The MSP ID of the organization the peer belongs to
 * @param {Array<string>} [opts.adminMspIds] - An Array of MSP ID's for organizations that have admin priviledges over the peer. Defaults to the peer's organization's mspId.
 * @param {string} [opts.role='member'] - The role of the Peer. Defaults to member
 * @param {FabricClient|UserClient} [opts.client] - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} [opts.eventUrl] - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} [opts.eventHubOpts] - The options for connecting to the peers event url
 * @param {EventHubManager} [opts.eventHubManager] - The eventHubManager to use, required if eventUrl and eventHubOpts aren't specified
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
 * @param {FabricClient|UserClient} [opts.client] - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} [opts.eventUrl] - The URL to listen to events from the Peer with
 * @param {ConnectionOpts} [opts.eventHubOpts] - The options for connecting to the peers event url
 * @param {EventHubManager} [opts.eventHubManager] - The eventHubManager to use, required if eventUrl and eventHubOpts aren't specified
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
