"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SRTFileImpl = void 0;
class SRTFileImpl {
    constructor(id, content, segments, totalDuration) {
        this.id = id;
        this.content = content;
        this.segments = segments;
        this.totalDuration = totalDuration;
    }
    validate() {
        return !!(this.id &&
            this.content &&
            this.segments &&
            this.segments.length > 0 &&
            this.totalDuration > 0);
    }
    generateContent() {
        return this.segments
            .map(segment => `${segment.index}\n${segment.startTime} --> ${segment.endTime}\n${segment.text}\n`)
            .join('\n');
    }
    static parseTimeString(timeStr) {
        const [time, ms] = timeStr.split(',');
        const [hours, minutes, seconds] = time?.split(':').map(Number) || [0, 0, 0];
        return hours * 3600 + minutes * 60 + seconds + (parseInt(ms || '0', 10) / 1000);
    }
    static formatTimeString(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }
}
exports.SRTFileImpl = SRTFileImpl;
