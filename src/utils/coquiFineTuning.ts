import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface FineTuningConfig {
  datasetPath: string;
  outputModelPath: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  referenceAudioPath?: string;
  languageCode: string;
}

export interface FineTuningProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  validationLoss: number;
  estimatedTimeRemaining: number;
}

export interface FineTuningResult {
  success: boolean;
  modelPath: string;
  finalLoss: number;
  trainingTime: number;
  error?: string;
}

export class CoquiFineTuningManager {
  private pythonProcess: ChildProcess | null = null;
  private isTraining: boolean = false;
  private progressCallback?: (progress: FineTuningProgress) => void;

  constructor() {}

  async startFineTuning(
    config: FineTuningConfig,
    onProgress?: (progress: FineTuningProgress) => void
  ): Promise<FineTuningResult> {
    if (this.isTraining) {
      throw new Error('Fine-tuning is already in progress');
    }

    this.progressCallback = onProgress;
    this.isTraining = true;

    try {
      // Validate dataset
      await this.validateDataset(config.datasetPath);

      // Prepare training configuration
      const trainingConfig = await this.prepareTrainingConfig(config);

      // Start Python training process
      const result = await this.runTrainingProcess(trainingConfig);

      return result;
    } catch (error) {
      return {
        success: false,
        modelPath: '',
        finalLoss: 0,
        trainingTime: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.isTraining = false;
      this.pythonProcess = null;
    }
  }

  async stopFineTuning(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
    }
    this.isTraining = false;
  }

  isCurrentlyTraining(): boolean {
    return this.isTraining;
  }

  private async validateDataset(datasetPath: string): Promise<void> {
    try {
      const stats = await fs.stat(datasetPath);
      if (!stats.isDirectory()) {
        throw new Error('Dataset path must be a directory');
      }

      // Check for required files
      const requiredFiles = ['metadata.csv', 'wavs'];
      for (const file of requiredFiles) {
        const filePath = path.join(datasetPath, file);
        try {
          await fs.access(filePath);
        } catch {
          throw new Error(`Required file/directory not found: ${file}`);
        }
      }

      // Validate metadata.csv format
      const metadataPath = path.join(datasetPath, 'metadata.csv');
      const metadata = await fs.readFile(metadataPath, 'utf-8');
      const lines = metadata.split('\n').filter(line => line.trim());
      
      if (lines.length < 10) {
        throw new Error('Dataset too small. Minimum 10 samples required for fine-tuning');
      }

      // Validate CSV format (filename|text)
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const parts = lines[i].split('|');
        if (parts.length < 2) {
          throw new Error(`Invalid metadata format at line ${i + 1}. Expected: filename|text`);
        }
      }

      console.log(`Dataset validation passed. Found ${lines.length} samples.`);
    } catch (error) {
      throw new Error(`Dataset validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async prepareTrainingConfig(config: FineTuningConfig): Promise<string> {
    const configData = {
      dataset_path: config.datasetPath,
      output_path: config.outputModelPath,
      epochs: config.epochs,
      batch_size: config.batchSize,
      learning_rate: config.learningRate,
      validation_split: config.validationSplit,
      language: config.languageCode,
      reference_audio: config.referenceAudioPath,
      
      // Coqui TTS specific settings
      model_name: "tts_models/multilingual/multi-dataset/your_tts",
      use_cuda: true,
      mixed_precision: true,
      
      // Audio processing settings
      sample_rate: 22050,
      hop_length: 256,
      win_length: 1024,
      n_mel_channels: 80,
      
      // Training settings
      save_step: 1000,
      eval_step: 500,
      print_step: 100,
      tb_model_param_stats: true,
      
      // Optimization settings
      optimizer: "AdamW",
      lr_scheduler: "ExponentialLR",
      lr_scheduler_params: {
        gamma: 0.999875,
        last_epoch: -1
      }
    };

    const configPath = path.join(config.outputModelPath, 'training_config.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2));

    return configPath;
  }

  private async runTrainingProcess(configPath: string): Promise<FineTuningResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let finalLoss = 0;

      // Use the Python bridge for training
      const pythonScript = path.join(__dirname, 'coqui_tts_training.py');
      
      this.pythonProcess = spawn('python', [pythonScript, configPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let outputBuffer = '';

      this.pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        
        // Parse training progress
        this.parseTrainingOutput(output);
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        console.error('Training error:', data.toString());
      });

      this.pythonProcess.on('close', (code) => {
        const trainingTime = Date.now() - startTime;
        
        if (code === 0) {
          resolve({
            success: true,
            modelPath: path.dirname(configPath),
            finalLoss,
            trainingTime
          });
        } else {
          reject(new Error(`Training process exited with code ${code}`));
        }
      });

      this.pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start training process: ${error.message}`));
      });
    });
  }

  private parseTrainingOutput(output: string): void {
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Parse epoch progress: "Epoch: 5/100, Loss: 0.234, Val Loss: 0.456"
      const epochMatch = line.match(/Epoch:\s*(\d+)\/(\d+).*Loss:\s*([\d.]+).*Val Loss:\s*([\d.]+)/);
      if (epochMatch && this.progressCallback) {
        const [, currentEpoch, totalEpochs, loss, valLoss] = epochMatch;
        
        const progress: FineTuningProgress = {
          epoch: parseInt(currentEpoch),
          totalEpochs: parseInt(totalEpochs),
          loss: parseFloat(loss),
          validationLoss: parseFloat(valLoss),
          estimatedTimeRemaining: this.estimateTimeRemaining(
            parseInt(currentEpoch),
            parseInt(totalEpochs)
          )
        };
        
        this.progressCallback(progress);
      }
    }
  }

  private estimateTimeRemaining(currentEpoch: number, totalEpochs: number): number {
    // Simple estimation based on current progress
    // In a real implementation, this would use actual timing data
    const progress = currentEpoch / totalEpochs;
    const estimatedTotalTime = 3600000; // 1 hour estimate
    return estimatedTotalTime * (1 - progress);
  }
}

// Utility functions for dataset preparation
export class DatasetPreparator {
  static async prepareFromAudioFiles(
    audioDir: string,
    transcriptionsFile: string,
    outputDir: string
  ): Promise<void> {
    // Create output directory structure
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'wavs'), { recursive: true });

    // Read transcriptions
    const transcriptions = await fs.readFile(transcriptionsFile, 'utf-8');
    const lines = transcriptions.split('\n').filter(line => line.trim());

    const metadata: string[] = [];

    for (const line of lines) {
      const [filename, text] = line.split('\t');
      if (!filename || !text) continue;

      // Copy audio file to wavs directory
      const sourcePath = path.join(audioDir, filename);
      const destPath = path.join(outputDir, 'wavs', filename);
      
      try {
        await fs.copyFile(sourcePath, destPath);
        metadata.push(`${filename}|${text.trim()}`);
      } catch (error) {
        console.warn(`Skipping file ${filename}: ${error}`);
      }
    }

    // Write metadata.csv
    const metadataPath = path.join(outputDir, 'metadata.csv');
    await fs.writeFile(metadataPath, metadata.join('\n'));

    console.log(`Dataset prepared: ${metadata.length} samples in ${outputDir}`);
  }

  static async validateAudioQuality(audioDir: string): Promise<ValidationReport> {
    const files = await fs.readdir(audioDir);
    const audioFiles = files.filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));

    const report: ValidationReport = {
      totalFiles: audioFiles.length,
      validFiles: 0,
      issues: []
    };

    // This would use audio analysis libraries to check:
    // - Sample rate consistency
    // - Audio quality
    // - Duration limits
    // - Noise levels

    report.validFiles = audioFiles.length; // Placeholder
    return report;
  }
}

export interface ValidationReport {
  totalFiles: number;
  validFiles: number;
  issues: string[];
}