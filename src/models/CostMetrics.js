"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostMetricsImpl = void 0;
class CostMetricsImpl {
    constructor(googleTTSCharacters = 0, googleTTSCost = 0, coquiTTSUsage = 0, computeTime = 0, totalCost = 0) {
        this.googleTTSCharacters = googleTTSCharacters;
        this.googleTTSCost = googleTTSCost;
        this.coquiTTSUsage = coquiTTSUsage;
        this.computeTime = computeTime;
        this.totalCost = totalCost;
    }
    addGoogleTTSUsage(characters, costPerCharacter) {
        this.googleTTSCharacters += characters;
        const cost = characters * costPerCharacter;
        this.googleTTSCost += cost;
        this.totalCost += cost;
    }
    addCoquiTTSUsage(computeTimeMs, costPerSecond) {
        const computeTimeSeconds = computeTimeMs / 1000;
        this.coquiTTSUsage += computeTimeSeconds;
        this.computeTime += computeTimeSeconds;
        const cost = computeTimeSeconds * costPerSecond;
        this.totalCost += cost;
    }
    validate() {
        return this.googleTTSCharacters >= 0 &&
            this.googleTTSCost >= 0 &&
            this.coquiTTSUsage >= 0 &&
            this.computeTime >= 0 &&
            this.totalCost >= 0;
    }
}
exports.CostMetricsImpl = CostMetricsImpl;
