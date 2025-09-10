"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionResultImpl = void 0;
class TranscriptionResultImpl {
    constructor(id, segments, language, confidence) {
        this.id = id;
        this.segments = segments;
        this.language = language;
        this.confidence = confidence;
    }
    validate() {
        return !!(this.id &&
            this.segments &&
            this.segments.length > 0 &&
            this.language &&
            this.confidence >= 0 &&
            this.confidence <= 1);
    }
    getTotalDuration() {
        if (this.segments.length === 0)
            return 0;
        const lastSegment = this.segments[this.segments.length - 1];
        return lastSegment?.endTime || 0;
    }
}
exports.TranscriptionResultImpl = TranscriptionResultImpl;
