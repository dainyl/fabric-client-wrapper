// @flow

/**
 * A Class that holds a map of transaction IDs and removes them after a period of time
 * @param [lifetime=300000] the amount of time in ms to hold onto a transaction ID
 */
export default class TransactionIdTimeMap {
    lifetime: number
    transactionIdMap: Map<string, number> // holds timeouts

    constructor(lifetime: number = 300000) {
        this.lifetime = lifetime
        this.transactionIdMap = new Map()
    }

    /**
     * Checks whether the Map has a transaction ID
     * @param transactionId - The transaction ID to check
     */
    has(transactionId: string): boolean {
        return this.transactionIdMap.has(transactionId)
    }

    /**
     * Sets the transaction ID in the map. If the transaction ID has been previously set it will reset the timer
     * @param transactionId - The transaction ID to set
     */
    set(transactionId: string) {
        const transactionIdMap = this.transactionIdMap
        if (transactionIdMap.has(transactionId)) {
            clearTimeout(transactionIdMap.get(transactionId))
        }
        const handle = (setTimeout(
            () => transactionIdMap.delete(transactionId),
            this.lifetime
        ): any)
        handle.unref()
        transactionIdMap.set(transactionId, handle)
    }

    /**
     * Clears all timers and transaction IDs
     */
    clear() {
        this.transactionIdMap.forEach(value => clearTimeout(value))
        this.transactionIdMap.clear()
    }
}
