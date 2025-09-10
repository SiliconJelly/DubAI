"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioSegmentImpl = void 0;
class AudioSegmentImpl {
    constructor(id, text, audioBuffer, startTime, endTime, voiceConfig) {
        this.id = id;
        this.text = text;
        this.audioBuffer = audioBuffer;
        this.startTime = startTime;
        this.endTime = endTime;
        this.voiceConfig = voiceConfig;
    }
    validate() {
        return !!(this.id &&
            this.text &&
            this.audioBuffer &&
            this.startTime >= 0 &&
            this.endTime > this.startTime &&
            this.voiceConfig);
    }
    getDuration() {
        return this.endTime - this.startTime;
    }
}
exports.AudioSegmentImpl = AudioSegmentImpl;
