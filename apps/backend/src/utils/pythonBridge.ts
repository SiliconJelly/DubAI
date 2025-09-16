import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TTSError } from '../types/errors';

export interface PythonBridgeConfig {
  pythonPath: string;
  scriptPath: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface PythonRequest {
  id: string;
  method: string;
  params: Record<string, any>;
}

export interface PythonResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export class PythonBridge {
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private config: PythonBridgeConfig;
  private isInitialized = false;

  constructor(config: PythonBridgeConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Python script exists
      await fs.access(this.config.scriptPath);
      
      // Start Python process
      this.process = spawn(this.config.pythonPath, [this.config.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up error handling
      this.process.on('error', (error) => {
        this.handleProcessError(new TTSError(`Python process error: ${error.message}`, 'coqui_local', error));
      });

      this.process.on('exit', (code, signal) => {
        if (code !== 0) {
          this.handleProcessError(new TTSError(`Python process exited with code ${code}, signal ${signal}`, 'coqui_local'));
        }
      });

      // Set up stdout handling for responses
      if (this.process.stdout) {
        let buffer = '';
        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response: PythonResponse = JSON.parse(line);
                this.handleResponse(response);
              } catch (error) {
                console.error('Failed to parse Python response:', line, error);
              }
            }
          }
        });
      }

      // Set up stderr handling for errors
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error('Python stderr:', data.toString());
        });
      }

      this.isInitialized = true;
    } catch (error) {
      throw new TTSError(`Failed to initialize Python bridge: ${(error as Error).message}`, 'coqui_local', error as Error);
    }
  }

  async sendRequest(method: string, params: Record<string, any>): Promise<any> {
    if (!this.isInitialized || !this.process) {
      throw new TTSError('Python bridge not initialized', 'coqui_local');
    }

    const request: PythonRequest = {
      id: uuidv4(),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new TTSError(`Python request timeout for method: ${method}`, 'coqui_local'));
      }, this.config.timeoutMs);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeout,
      });

      // Send request to Python process
      if (this.process && this.process.stdin) {
        this.process.stdin.write(JSON.stringify(request) + '\n');
      } else {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);
        reject(new TTSError('Python process stdin not available', 'coqui_local'));
      }
    });
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      // Clear all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new TTSError('Python bridge shutting down', 'coqui_local'));
      }
      this.pendingRequests.clear();

      // Terminate Python process
      this.process.kill('SIGTERM');
      
      // Wait for process to exit or force kill after timeout
      await new Promise<void>((resolve) => {
        const forceKillTimeout = setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        if (this.process) {
          this.process.on('exit', () => {
            clearTimeout(forceKillTimeout);
            resolve();
          });
        } else {
          clearTimeout(forceKillTimeout);
          resolve();
        }
      });

      this.process = null;
    }
    
    this.isInitialized = false;
  }

  private handleResponse(response: PythonResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('Received response for unknown request ID:', response.id);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new TTSError(response.error || 'Unknown Python error', 'coqui_local'));
    }
  }

  private handleProcessError(error: TTSError): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
    
    this.isInitialized = false;
    this.process = null;
  }

  isReady(): boolean {
    return this.isInitialized && this.process !== null && !this.process.killed;
  }
}