"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceConfigImpl = void 0;
class VoiceConfigImpl {
    constructor(languageCode, voiceName, gender, speakingRate = 1.0, pitch = 0.0, volumeGainDb = 0.0) {
        this.languageCode = languageCode;
        this.voiceName = voiceName;
        this.gender = gender;
        this.speakingRate = speakingRate;
        this.pitch = pitch;
        this.volumeGainDb = volumeGainDb;
    }
    validate() {
        return !!(this.languageCode &&
            this.voiceName &&
            this.gender &&
            this.speakingRate > 0 &&
            this.speakingRate <= 4.0);
    }
}
exports.VoiceConfigImpl = VoiceConfigImpl;
