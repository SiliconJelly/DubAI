import { UsageMetrics, QuotaStatus } from '../types/common';

export interface CostMetrics {
  googleTTSCharacters: number;
  googleTTSCost: number;
  coquiTTSUsage: number;
  computeTime: number;
  totalCost: number;
}

export class CostMetricsImpl implements CostMetrics {
  constructor(
    public googleTTSCharacters: number = 0,
    public googleTTSCost: number = 0,
    public coquiTTSUsage: number = 0,
    public computeTime: number = 0,
    public totalCost: number = 0
  ) {}

  addGoogleTTSUsage(characters: number, costPerCharacter: number): void {
    this.googleTTSCharacters += characters;
    const cost = characters * costPerCharacter;
    this.googleTTSCost += cost;
    this.totalCost += cost;
  }

  addCoquiTTSUsage(computeTimeMs: number, costPerSecond: number): void {
    const computeTimeSeconds = computeTimeMs / 1000;
    this.coquiTTSUsage += computeTimeSeconds;
    this.computeTime += computeTimeSeconds;
    const cost = computeTimeSeconds * costPerSecond;
    this.totalCost += cost;
  }

  validate(): boolean {
    return this.googleTTSCharacters >= 0 && 
           this.googleTTSCost >= 0 && 
           this.coquiTTSUsage >= 0 && 
           this.computeTime >= 0 && 
           this.totalCost >= 0;
  }
}