/* Microphone → 16 kHz mono chunks for on-device voice following. Audio never leaves this device.
 * Adapted from Tilawa's web demo (web/frontend/public/audio-processor.js), MIT licence,
 * https://github.com/yazinsai/tilawa. The resampler keeps a continuous phase across render
 * quanta; resetting it per block stretches tempo enough to change the recognised phonemes. */
class AyahFlowCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = [];
        this.chunk = 4800; // 300 ms at 16 kHz
        this.phase = 0;
        this.last = 0;
    }
    process(inputs) {
        const data = inputs[0] && inputs[0][0];
        if (!data) return true;
        const ratio = sampleRate / 16000;
        if (ratio === 1) {
            for (let i = 0; i < data.length; i++) this.buffer.push(data[i]);
        } else {
            let pos = this.phase;
            const n = data.length;
            while (pos < n) {
                const i0 = Math.floor(pos), frac = pos - i0;
                const s0 = i0 < 0 ? this.last : data[i0];
                const s1 = i0 + 1 < n ? data[i0 + 1] : data[n - 1];
                this.buffer.push(s0 + (s1 - s0) * frac);
                pos += ratio;
            }
            this.phase = pos - n;
            this.last = data[n - 1];
        }
        if (this.buffer.length >= this.chunk) {
            const out = new Float32Array(this.buffer);
            this.port.postMessage(out.buffer, [out.buffer]);
            this.buffer = [];
        }
        return true;
    }
}
registerProcessor('ayahflow-capture', AyahFlowCapture);
