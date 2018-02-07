// @flow

export const DEFAULT_PORT = 45207
export const PATH_CHAR = "/"
export const SPLIT_CHAR = "-"
export const PACKET_BOUNDARY = ";"

export const TYPES = {
    SERVER_READY: "SERVER_READY",
    CLIENT_READY: "CLIENT_READY",
    CLIENT_INIT: "CLIENT_INIT",
    CLIENT_DONE: "CLIENT_DONE",
    SERVER_DONE: "SERVER_DONE"
}

export const createServerReadyMessage = (channelName: string) =>
    `${channelName}/${TYPES.SERVER_READY}${PACKET_BOUNDARY}`
export const createClientReadyMessage = (channelName: string) =>
    `${channelName}/${TYPES.CLIENT_READY}${PACKET_BOUNDARY}`
export const createClientInitMessage = (channelName: string) =>
    `${channelName}/${TYPES.CLIENT_INIT}${PACKET_BOUNDARY}`
export const createClientDoneMessage = (
    channelName: string,
    mspIds: Array<string>
) =>
    `${channelName}/${TYPES.CLIENT_DONE}/${mspIds.join(SPLIT_CHAR)}${
        PACKET_BOUNDARY
    }`
export const createServerDoneMessage = (channelName: string) =>
    `${channelName}/${TYPES.SERVER_DONE}${PACKET_BOUNDARY}`

export const extractMessage = (message: string) => {
    const messageArray = message.split(PATH_CHAR)
    const channelName = messageArray[0]
    const type = messageArray[1]
    const body = messageArray[2] ? messageArray[2].split(SPLIT_CHAR) : null

    return {
        channelName,
        type,
        body
    }
}

export const extract = (messages: string) => {
    const array = messages
        .split(PACKET_BOUNDARY)
        .map(message => extractMessage(message))
    array.pop()
    return array
}
