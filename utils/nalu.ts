/*
 * @Author: Sunqi
 * @Date: 2020-06-16 11:48:00
 */ 
export class NALU {

    static get NDR(): number { return 1; }
    static get IDR(): number { return 5; }
    static get SEI(): number { return 6; }
    static get SPS(): number { return 7; }
    static get PPS(): number { return 8; }
    static get AUD(): number { return 9; }

    static get TYPES() {
        return {
            [NALU.IDR]: "IDR",
            [NALU.SEI]: "SEI",
            [NALU.SPS]: "SPS",
            [NALU.PPS]: "PPS",
            [NALU.NDR]: "NDR",
            [NALU.AUD]: "AUD",
        };
    }

    static type(nalu: NALU) {
        if (nalu.ntype in NALU.TYPES) {
            return NALU.TYPES[nalu.ntype];
        } else {
            return "UNKNOWN";
        }
    }

    payload: Buffer
    nri: number
    ntype: number

    constructor(data: Buffer) {
        this.payload = data;
        this.nri = (this.payload[0] & 0x60) >> 5;
        this.ntype = this.payload[0] & 0x1f;
    }

    toString(): string {
        return `${NALU.type(this)}: NRI: ${this.getNri()}`;
    }

    getNri(): number {
        return this.nri >> 6;
    }

    type(): number {
        return this.ntype;
    }

    isKeyframe(): boolean {
        return this.ntype == NALU.IDR;
    }

    getSize(): number {
        return 4 + this.payload.byteLength;
    }

    getData(): Uint8Array {
        const result = new Uint8Array(this.getSize());
        const view = new DataView(result.buffer);
        view.setUint32(0, this.getSize() - 4);
        result.set(this.payload, 4);
        return result;
    }
}
