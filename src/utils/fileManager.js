"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const constants_1 = require("./constants");
class FileManager {
    constructor(config) {
        this.config = config;
    }
    async createTempFile(extension, sessionId) {
        const filename = `${sessionId || (0, uuid_1.v4)()}_${Date.now()}.${extension}`;
        const filepath = path.join(this.config.tempDirectory, filename);
        // Ensure temp directory exists
        await fs.mkdir(this.config.tempDirectory, { recursive: true });
        return filepath;
    }
    async createOutputFile(originalName, suffix = '_dubbed') {
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const filename = `${name}${suffix}${ext}`;
        const filepath = path.join(this.config.outputDirectory, filename);
        // Ensure output directory exists
        await fs.mkdir(this.config.outputDirectory, { recursive: true });
        return filepath;
    }
    async saveUploadedFile(file, sessionId) {
        const ext = path.extname(file.originalname);
        const filepath = await this.createTempFile(ext.slice(1), sessionId);
        await fs.writeFile(filepath, file.buffer);
        return filepath;
    }
    async cleanupTempFiles(sessionId) {
        try {
            const files = await fs.readdir(this.config.tempDirectory);
            const now = Date.now();
            const maxAge = constants_1.FILE_SIZE_LIMITS.TEMP_FILE_CLEANUP_HOURS * 60 * 60 * 1000;
            for (const file of files) {
                const filepath = path.join(this.config.tempDirectory, file);
                // If sessionId is provided, only clean files for that session
                if (sessionId && !file.includes(sessionId)) {
                    continue;
                }
                try {
                    const stats = await fs.stat(filepath);
                    if (now - stats.mtime.getTime() > maxAge) {
                        await fs.unlink(filepath);
                    }
                }
                catch (error) {
                    // File might have been deleted already, ignore
                    console.warn(`Failed to clean up file ${filepath}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Failed to cleanup temp files:', error);
        }
    }
    async fileExists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileSize(filepath) {
        const stats = await fs.stat(filepath);
        return stats.size;
    }
    async deleteFile(filepath) {
        try {
            await fs.unlink(filepath);
        }
        catch (error) {
            console.warn(`Failed to delete file ${filepath}:`, error);
        }
    }
}
exports.FileManager = FileManager;
