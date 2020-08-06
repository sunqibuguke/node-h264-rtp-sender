/*
 * @Author: Sunqi
 * @Date: 2020-06-16 11:47:45
 */ 
declare class H264Parser {
    static extractNALu: (buffer: Buffer) => Array<Buffer>
    skipScalingList: (decoder: any, count: number) => void
    readSPS: (sps: Uint8Array) =>any
    remuxer: any
    track: any
    static parseSPS: (sps: any) =>any
    parsePPS: (pps: Uint8Array) => void
    parseNAL: (unit: Uint8Array) => boolean
}
export default  H264Parser 