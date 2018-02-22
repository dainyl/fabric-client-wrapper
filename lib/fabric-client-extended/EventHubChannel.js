// @flow

import type FabricClient from "fabric-client"
import Channel from "fabric-client/lib/Channel"
import type Peer from "fabric-client/lib/Peer"
import type Orderer from "fabric-client/lib/Orderer"
import EventHub from "fabric-client/lib/EventHub"
import type { ConnectionOpts } from "../FABRIC_FLOW_TYPES"
import type UserClient from "../UserClient"
import EventHubManager from "../EventHubManager"
import newChannel from "../newChannel"

type EventHubChannelOpts =
    | {
          eventUrl: string,
          eventHubOpts: ConnectionOpts
      }
    | EventHubManager
export type ChannelOpts = {
    channelName: string,
    client: FabricClient | UserClient,
    peers?: Array<Peer>,
    orderers?: Array<Orderer>
}

/**
 * Options to create a EventHubChannel
 * @typedef {Object} NewEventHubChannelOpts
 * @property {string} channelName - The name of the channel
 * @property {FabricClient|UserClient} [client] - The client context to use for operations
 * @property {Array<Peer>} [peers] - An array of peers to use for channel operations
 * @property {Array<Orderer>} orderers - The orderers to use for the channel
 * @property {string} [eventUrl] - The URL to listen to events from the Channel with
 * @property {ConnectionOpts} [eventHubOpts] - The options for connecting to the event url
 * @property {EventHubManager} [eventHubManager] - The eventHubManager to use, required if eventUrl and eventHubOpts aren't specified
 */
export type NewEventHubChannelOpts = ChannelOpts & {
    eventUrl: ?string,
    eventHubOpts?: ConnectionOpts,
    eventHubManager?: EventHubManager
}

/**
 * A fabric-client Channel with additional MSP information and an EventHubManager
 * @typedef {Object} EventHubChannel
 * @augments FcwChannel
 */

/**
 * Upgrades a Channel with an EventHubManager
 * @param {Channel} fcwChannel
 * @param {EventHubManager|Object} opts - The options for upgrading the Channel or an EventHubManager
 * @param {FabricClient|UserClient} opts.client - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} opts.eventUrl - The URL to listen to events from the Channel with
 * @param {ConnectionOpts} opts.eventHubOpts - The options for connecting to the event url
 * @returns {EventHubChannel} The EventHubChannel
 */
export function upgradeChannelToEventHubChannel(
    channel: Channel,
    opts: EventHubChannelOpts
): Channel {
    let eventHubManager
    if (opts.eventUrl && opts.eventHubOpts) {
        const eventHub = new EventHub(channel._clientContext)
        eventHub.setPeerAddr(opts.eventUrl, opts.eventHubOpts)
        eventHubManager = new EventHubManager(eventHub)
    } else {
        eventHubManager = opts
    }

    channel.eventHubManager = eventHubManager
    /**
     * Gets the Channel's EventHubManager
     * @typedef getEventHubManager
     * @memberof EventHubChannel#
     * @returns {EventHubManager} The Channel's EventHubManager
     */
    channel.getEventHubManager = () => channel.eventHubManager

    return channel
}

/**
 * Creates a fabric-client Channel and adds an EventHubManager
 * @param opts - The options for creating the EventhHubChannel
 * @param {string} opts.requestUrl - The URL to issue requests to the Channel with
 * @param {ConnectionOpts} opts.channelOpts - The options for connecting to the channel's request url
 * @param {FabricClient|UserClient} opts.client - The Client/UserClient tied to the user that creates the EventHub
 * @param {string} opts.eventUrl - The URL to listen to events from the Channel with
 * @param {ConnectionOpts} opts.eventHubOpts - The options for connecting to the channels event url
 * @returns {EventHubChannel} The EventHubChannel
 */
export function newEventHubChannel({
    channelName,
    client,
    peers,
    orderers,
    eventUrl,
    eventHubOpts,
    eventHubManager
}: NewEventHubChannelOpts): Channel {
    return upgradeChannelToEventHubChannel(
        newChannel({
            channelName,
            client,
            peers,
            orderers
        }),
        (eventHubManager || { eventUrl, eventHubOpts }: any)
    )
}

/**
 * Checks whether an object is a EventHubChannel
 * @param obj - The object to check
 * @returns true if the object is a EventHubChannel, false otherwise
 */
export function isEventHubChannel(obj: any): boolean {
    return obj.getEventHubManager
}
