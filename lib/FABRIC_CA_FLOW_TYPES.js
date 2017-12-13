// @flow

export type TLSOptions = Object
export type RegisterRequest = {
    enrollmentID: string,
    enrollmentSecret: string,
    affiliation: string,
    role?: string,
    maxEnrollments?: number,
    attrs?: Array<Object>
}
