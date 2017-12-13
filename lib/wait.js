/**
 * Creates a promise that resolves after a set period of time
 * @ignore
 * @param {number} time - The number of ms to wait
 * @returns {Promise.<number>} The promise resolve with
 */
export default function wait(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}
