"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoFileImpl = void 0;
class VideoFileImpl {
    constructor(id, filename, path, format, duration, resolution, metadata) {
        this.id = id;
        this.filename = filename;
        this.path = path;
        this.format = format;
        this.duration = duration;
        this.resolution = resolution;
        this.metadata = metadata;
    }
    validate() {
        return !!(this.id && this.filename && this.path && this.format && this.duration > 0);
    }
}
exports.VideoFileImpl = VideoFileImpl;
