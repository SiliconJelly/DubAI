#!/usr/bin/env python3
"""
Coqui TTS Fine-tuning Script for Bangla Voice Models
Integrates with the Node.js TypeScript application for model training
"""

import sys
import json
import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import torch
    from TTS.api import TTS
    from TTS.tts.configs.shared_configs import BaseDatasetConfig
    from TTS.tts.configs.vits_config import VitsConfig
    from TTS.tts.datasets import load_tts_samples
    from TTS.tts.models.vits import Vits, VitsAudioConfig
    from TTS.tts.utils.text.tokenizer import TTSTokenizer
    from TTS.utils.audio import AudioProcessor
    from trainer import Trainer, TrainerArgs
except ImportError as e:
    print(f"Error: Required TTS library not installed: {e}")
    print("Please install Coqui TTS: pip install TTS")
    sys.exit(1)

class CoquiFineTuner:
    def __init__(self, config_path: str):
        """Initialize the fine-tuner with configuration"""
        self.config_path = config_path
        self.config = self.load_config()
        self.setup_logging()
        
    def load_config(self) -> Dict[str, Any]:
        """Load training configuration from JSON file"""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            raise ValueError(f"Failed to load config from {self.config_path}: {e}")
    
    def setup_logging(self):
        """Setup logging for training process"""
        log_level = logging.INFO
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler(
                    os.path.join(self.config['output_path'], 'training.log')
                )
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def prepare_dataset_config(self) -> BaseDatasetConfig:
        """Prepare dataset configuration for Coqui TTS"""
        dataset_config = BaseDatasetConfig(
            formatter="ljspeech",  # Use LJSpeech format for metadata.csv
            meta_file_train="metadata.csv",
            path=self.config['dataset_path'],
            language=self.config['language'],
        )
        return dataset_config
    
    def create_model_config(self) -> VitsConfig:
        """Create VITS model configuration for fine-tuning"""
        
        # Audio configuration
        audio_config = VitsAudioConfig(
            sample_rate=self.config.get('sample_rate', 22050),
            hop_length=self.config.get('hop_length', 256),
            win_length=self.config.get('win_length', 1024),
            n_mel_channels=self.config.get('n_mel_channels', 80),
            mel_fmin=0.0,
            mel_fmax=None,
        )
        
        # Model configuration
        config = VitsConfig(
            audio=audio_config,
            run_name="bangla_tts_finetune",
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            eval_batch_size=self.config['batch_size'],
            num_loader_workers=4,
            num_eval_loader_workers=4,
            run_eval=True,
            test_delay_epochs=-1,
            ga_alpha=1.0,
            iters_to_accumulate=1,
            binary_align_loss_weight=1.0,
            use_mel_spec_loss=True,
            mel_loss_weight=45.0,
            char_loss_weight=1.0,
            binary_loss_weight=1.0,
            
            # Learning rate and optimization
            lr=self.config['learning_rate'],
            lr_scheduler="ExponentialLR",
            lr_scheduler_params=self.config.get('lr_scheduler_params', {"gamma": 0.999875}),
            optimizer="AdamW",
            optimizer_params={"betas": [0.8, 0.99], "eps": 1e-9, "weight_decay": 0.01},
            
            # Validation
            run_eval_steps=self.config.get('eval_step', 500),
            eval_split_max_size=self.config.get('validation_split', 0.1),
            eval_split_size=self.config.get('validation_split', 0.1),
            
            # Logging and saving
            print_step=self.config.get('print_step', 100),
            plot_step=self.config.get('eval_step', 500),
            log_model_step=self.config.get('save_step', 1000),
            save_step=self.config.get('save_step', 1000),
            save_n_checkpoints=5,
            save_checkpoints=True,
            
            # Output
            output_path=self.config['output_path'],
            
            # Dataset
            datasets=[self.prepare_dataset_config()],
            
            # Text processing
            text_cleaner="phoneme_cleaners",
            enable_eos_bos_chars=False,
            test_sentences_file="",
            phoneme_cache_path=os.path.join(self.config['output_path'], "phoneme_cache"),
            precompute_num_workers=4,
            
            # Model architecture
            hidden_channels=192,
            hidden_channels_ffn_text_encoder=768,
            num_heads_text_encoder=2,
            num_layers_text_encoder=6,
            kernel_size_text_encoder=3,
            dropout_p_text_encoder=0.1,
            
            # VITS specific
            use_transformer=True,
            use_stochastic_duration_prediction=True,
            use_mel_spec_loss=True,
            use_phonemes=False,  # Set to True if using phonemes
            compute_linear_spec=True,
            
            # Mixed precision training
            mixed_precision=self.config.get('mixed_precision', True),
        )
        
        return config
    
    def load_pretrained_model(self) -> Optional[str]:
        """Load a pretrained model for fine-tuning"""
        model_name = self.config.get('model_name', 'tts_models/multilingual/multi-dataset/your_tts')
        
        try:
            # Download pretrained model
            tts = TTS(model_name)
            model_path = tts.model_path
            self.logger.info(f"Loaded pretrained model: {model_name}")
            return model_path
        except Exception as e:
            self.logger.warning(f"Could not load pretrained model {model_name}: {e}")
            return None
    
    def start_training(self):
        """Start the fine-tuning process"""
        try:
            self.logger.info("Starting Coqui TTS fine-tuning...")
            
            # Create output directory
            os.makedirs(self.config['output_path'], exist_ok=True)
            
            # Prepare configuration
            config = self.create_model_config()
            
            # Load pretrained model if specified
            pretrained_path = self.load_pretrained_model()
            
            # Initialize trainer
            trainer = Trainer(
                TrainerArgs(),
                config,
                self.config['output_path'],
                model=Vits(config),
                train_samples=None,  # Will be loaded by trainer
                eval_samples=None,   # Will be loaded by trainer
            )
            
            # Start training
            if pretrained_path:
                self.logger.info(f"Fine-tuning from pretrained model: {pretrained_path}")
                trainer.fit(restore_path=pretrained_path)
            else:
                self.logger.info("Training from scratch")
                trainer.fit()
                
            self.logger.info("Training completed successfully!")
            
        except Exception as e:
            self.logger.error(f"Training failed: {e}")
            raise
    
    def validate_model(self, model_path: str, test_texts: list):
        """Validate the trained model with test texts"""
        try:
            # Load the trained model
            tts = TTS(model_path=model_path, config_path=os.path.join(model_path, "config.json"))
            
            validation_results = []
            
            for i, text in enumerate(test_texts):
                try:
                    # Generate audio
                    output_path = os.path.join(model_path, f"validation_{i}.wav")
                    tts.tts_to_file(text=text, file_path=output_path)
                    
                    validation_results.append({
                        "text": text,
                        "success": True,
                        "output_path": output_path
                    })
                    
                    self.logger.info(f"Validation {i+1}/{len(test_texts)}: SUCCESS")
                    
                except Exception as e:
                    validation_results.append({
                        "text": text,
                        "success": False,
                        "error": str(e)
                    })
                    self.logger.error(f"Validation {i+1}/{len(test_texts)}: FAILED - {e}")
            
            # Save validation results
            results_path = os.path.join(model_path, "validation_results.json")
            with open(results_path, 'w') as f:
                json.dump(validation_results, f, indent=2, ensure_ascii=False)
            
            return validation_results
            
        except Exception as e:
            self.logger.error(f"Model validation failed: {e}")
            raise

def main():
    """Main entry point for the training script"""
    if len(sys.argv) != 2:
        print("Usage: python coqui_tts_training.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    try:
        # Initialize fine-tuner
        fine_tuner = CoquiFineTuner(config_path)
        
        # Start training
        fine_tuner.start_training()
        
        # Optional: Run validation if test texts are provided
        test_texts = [
            "আমি বাংলায় কথা বলতে পারি।",
            "এটি একটি পরীক্ষামূলক বাক্য।",
            "কৃত্রিম বুদ্ধিমত্তা অনেক উন্নত হয়েছে।"
        ]
        
        model_path = fine_tuner.config['output_path']
        if os.path.exists(os.path.join(model_path, "best_model.pth")):
            fine_tuner.validate_model(model_path, test_texts)
        
        print("Training and validation completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()