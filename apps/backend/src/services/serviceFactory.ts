import { SupabaseClient } from '@supabase/supabase-js';
import { FileStorageService } from './FileStorageService';
import { FileProcessingPipeline } from './FileProcessingPipeline';
import { FileManager } from '../utils/fileManager';
import { ConfigurationManagerImpl } from './ConfigurationManager';

/**
 * Service factory for initializing file-related services
 */
export function initializeServices(supabase: SupabaseClient) {
  // Initialize configuration manager
  const configManager = new ConfigurationManagerImpl();
  
  // Initialize file manager with configuration
  const fileManager = new FileManager({
    tempDirectory: process.env['TEMP_DIRECTORY'] || './temp',
    outputDirectory: process.env['OUTPUT_DIRECTORY'] || './output',
    cleanupIntervalHours: 24
  });

  // Initialize file storage service
  const fileStorageService = new FileStorageService(supabase, fileManager);

  // Initialize file processing pipeline
  const processingPipeline = new FileProcessingPipeline(
    supabase,
    fileStorageService,
    fileManager
  );

  return {
    fileStorageService,
    processingPipeline,
    fileManager,
    configManager
  };
}

/**
 * Type for the initialized services
 */
export type InitializedServices = ReturnType<typeof initializeServices>;