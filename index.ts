/*
 * @Author: Sunqi
 * @Date: 2020-06-16 17:02:54
 * @LastEditTime: 2020-07-22 15:11:07
 * @Description: H264 NALU 分包
 */
import { NALU } from "./utils/nalu";
import H264Parser from "./utils/h264.js";
const DEFAULT_RTP_PKT_LENGTH = 1400;
import { EventEmitter } from "events";

export type H264RtpConfig = {
    // payload_type
    pt: number;
    ssrc: number;
    // max rtp package size, < 1500 Bytes
    pkg_size: number
}

export type NalHeader = {
    forbiddenBit: number;
    nri: number[];
    nalType: number[];

}
export default class H264RtpPacket extends EventEmitter {
    private config: H264RtpConfig
    private hdr: Buffer
    private timestamp = 0
    private sn = 0
    constructor(config: H264RtpConfig) {
        super();
        this.config = config;
        this.config.ssrc = this.config.ssrc || 1
        this.config.pt = this.config.pt || 96
        this.config.pkg_size = this.config.pkg_size || DEFAULT_RTP_PKT_LENGTH
    }


    public feed(data: Buffer): boolean {
        const nalus: Buffer[] = H264Parser.extractNALu(data);
        if (!nalus.length) {
            console.error('no nalus')
            return false;
        }
        this.timestamp += 3000;
        nalus.forEach(nalu => {
            const obj = new NALU(nalu);
            const type = NALU.type(obj);
            // 过滤不需要发送的 nalu
            if (type != "SEI" && type != "AUD") {
                this.handleNalu(obj.payload);
            }
        });
        return true;
    }

    private handleNalu(_nalu: Uint8Array): void {
        const nalu = Buffer.from(_nalu);
        if (nalu.byteLength - 1 < this.config.pkg_size) {
            this.rtpH264PackNalu(nalu);
        } else {
            this.rtpH264PackFuA(nalu);
        }
    }

    private setHeaderBuffer(isEnd: boolean) {
        if (this.sn >= 0xffff) {
            this.sn = 0;
        }
        this.hdr = Buffer.alloc(12);
        this.hdr[0] = 0x80;
        this.hdr[1] = ((isEnd ? 1 : 0) << 7 | this.config.pt);
        this.hdr[2] = (this.sn >>> 8);
        this.hdr[3] = (this.sn & 0xFF);

        this.hdr[4] = (this.timestamp >>> 24);
        this.hdr[5] = (this.timestamp >>> 16 & 0xFF);
        this.hdr[6] = (this.timestamp >>> 8 & 0xFF);

        this.hdr[8] = (this.config.ssrc >>> 24);
        this.hdr[9] = (this.config.ssrc >>> 16 & 0xFF);
        this.hdr[10] = (this.config.ssrc >>> 8 & 0xFF);
        this.hdr[11] = (this.config.ssrc & 0xFF);

        this.sn++;
    }

    private parseNaluHeader(hdr: Buffer): NalHeader {
        const forbiddenBit: number = this.readBit(hdr, 0, 7);
        const nri: number[] = [
            this.readBit(hdr, 0, 6),
            this.readBit(hdr, 0, 5),
        ];
        const nalType = [
            this.readBit(hdr, 0, 4),
            this.readBit(hdr, 0, 3),
            this.readBit(hdr, 0, 2),
            this.readBit(hdr, 0, 1),
            this.readBit(hdr, 0, 0),
        ];
        return {
            forbiddenBit,
            nri,
            nalType
        };
    }

    private rtpH264PackNalu(nalu: Buffer) {
        this.setHeaderBuffer(false);
        const pkg: Buffer = Buffer.concat([this.hdr, nalu], 12 + nalu.byteLength);
        this.onPackage(pkg);
    }

    private rtpH264PackFuA(nalu: Buffer): void {
        const splitPkgCount = ~~((nalu.byteLength - 1) / this.config.pkg_size);
        const lastPkgBytes: number = nalu.byteLength - 1 - splitPkgCount * this.config.pkg_size;
        const nalHeader: NalHeader = this.parseNaluHeader(Buffer.from(nalu, 0, 1));
        const fuInd: Buffer = this.genFuInd(nalHeader);
        let index = 0;
        while (index < splitPkgCount) {
            const nalSegment: Buffer = Buffer.alloc(this.config.pkg_size);
            nalu.copy(nalSegment, 0, 1 + index * this.config.pkg_size, 1 + (index + 1) * this.config.pkg_size);
            const isStart = index == 0;
            const isEnd = lastPkgBytes > 0 ? false : (index == splitPkgCount - 1);
            this.setHeaderBuffer(isEnd);
            const fuHeader = this.genFuHeader(nalHeader, isStart, isEnd);
            const pkg = Buffer.concat([this.hdr, fuInd, fuHeader, nalSegment]);
            this.onPackage(pkg);
            index++;
        }

        // 有一定概率整除
        if (lastPkgBytes > 0) {
            const lastSegmentNal = Buffer.alloc(lastPkgBytes);
            nalu.copy(lastSegmentNal, 0, 1 + splitPkgCount * this.config.pkg_size);
            const fuHeader = this.genFuHeader(nalHeader, false, true);
            this.setHeaderBuffer(true);
            const pkg = Buffer.concat([this.hdr, fuInd, fuHeader, lastSegmentNal]);
            this.onPackage(pkg);
        }
    }



    private genFuInd(nalHeader: NalHeader): Buffer {
        const buf: Buffer = Buffer.alloc(1);
        buf.writeUInt8(28, 0);
        this.writeBit(buf, 0, 7, 0);
        this.writeBit(buf, 0, 6, nalHeader.nri[0]);
        this.writeBit(buf, 0, 5, nalHeader.nri[1]);
        return buf;
    }


    private genFuHeader(nalHeader: NalHeader, isStart: boolean, isEnd: boolean): Buffer {
        const buf: Buffer = Buffer.alloc(1);
        this.writeBit(buf, 0, 7, isStart ? 1 : 0);
        this.writeBit(buf, 0, 6, isEnd ? 1 : 0);
        this.writeBit(buf, 0, 4, nalHeader.nalType[0]);
        this.writeBit(buf, 0, 3, nalHeader.nalType[1]);
        this.writeBit(buf, 0, 2, nalHeader.nalType[2]);
        this.writeBit(buf, 0, 1, nalHeader.nalType[3]);
        this.writeBit(buf, 0, 0, nalHeader.nalType[4]);
        return buf;
    }

    private writeBit(buffer: Buffer, i: number, bit: number, value: number): void {
        if (value == 0) {
            buffer[i] &= ~(1 << bit);
        } else {
            buffer[i] |= (1 << bit);
        }
    }

    private readBit(buffer: Buffer, i: number, bit: number): number {
        return (buffer[i] >> bit) % 2;
    }

    private onPackage(pkg: Buffer) {
        this.emit('pkg', pkg);
    }
}