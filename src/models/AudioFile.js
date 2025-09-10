"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioFileImpl = void 0;
class AudioFileImpl {
    constructor(id, filename, path, format, duration, sampleRate, channels) {
        this.id = id;
        this.filename = filename;
        this.path = path;
        this.format = format;
        this.duration = duration;
        this.sampleRate = sampleRate;
        this.channels = channels;
    }
    validate() {
        return !!(this.id &&
            this.filename &&
            this.path &&
            this.format &&
            this.duration > 0 &&
            this.sampleRate > 0 &&
            this.channels > 0);
    }
}
exports.AudioFileImpl = AudioFileImpl;
