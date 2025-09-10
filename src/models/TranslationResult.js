"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationResultImpl = void 0;
class TranslationResultImpl {
    constructor(id, originalText, translatedText, segments, targetLanguage) {
        this.id = id;
        this.originalText = originalText;
        this.translatedText = translatedText;
        this.segments = segments;
        this.targetLanguage = targetLanguage;
    }
    validate() {
        return !!(this.id &&
            this.originalText &&
            this.translatedText &&
            this.segments &&
            this.segments.length > 0 &&
            this.targetLanguage);
    }
    getTotalDuration() {
        if (this.segments.length === 0)
            return 0;
        const lastSegment = this.segments[this.segments.length - 1];
        return lastSegment?.endTime || 0;
    }
}
exports.TranslationResultImpl = TranslationResultImpl;
