#!/usr/bin/env python3
"""
Python bridge for Coqui TTS integration with Node.js
Handles model loading, caching, and speech synthesis
"""

import sys
import json
import os
import traceback
import tempfile
import base64
from typing import Dict, Any, Optional
from pathlib import Path

try:
    import torch
    from TTS.api import TTS
    from TTS.utils.manage import ModelManager
except ImportError as e:
    print(json.dumps({
        "id": "init_error",
        "success": False,
        "error": f"Failed to import TTS dependencies: {str(e)}. Please install TTS with: pip install TTS"
    }), flush=True)
    sys.exit(1)

class CoquiTTSBridge:
    def __init__(self):
        self.tts_model: Optional[TTS] = None
        self.current_model_path: Optional[str] = None
        self.model_info: Dict[str, Any] = {}
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
    def load_model(self, model_path: str, config_path: Optional[str] = None, 
                   speaker_wav: Optional[str] = None, use_gpu: bool = True) -> Dict[str, Any]:
        """Load a Coqui TTS model"""
        try:
            # Determine device
            device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
            
            # Check if model is already loaded
            if self.tts_model and self.current_model_path == model_path:
                return {
                    "success": True,
                    "message": "Model already loaded",
                    "model_info": self.model_info
                }
            
            # Load the model
            if model_path.startswith("tts_models/"):
                # Pre-trained model from Coqui model zoo
                self.tts_model = TTS(model_path).to(device)
            else:
                # Local model file
                if not os.path.exists(model_path):
                    raise FileNotFoundError(f"Model file not found: {model_path}")
                
                if config_path and not os.path.exists(config_path):
                    raise FileNotFoundError(f"Config file not found: {config_path}")
                
                self.tts_model = TTS(model_path=model_path, config_path=config_path).to(device)
            
            self.current_model_path = model_path
            
            # Get model information
            self.model_info = {
                "name": os.path.basename(model_path),
                "path": model_path,
                "device": device,
                "language": getattr(self.tts_model, 'language', 'unknown'),
                "loaded_at": str(torch.utils.data.get_worker_info() or "unknown"),
                "speakers": getattr(self.tts_model, 'speakers', []) if hasattr(self.tts_model, 'speakers') else [],
                "use_gpu": device == "cuda"
            }
            
            return {
                "success": True,
                "message": f"Model loaded successfully on {device}",
                "model_info": self.model_info
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load model: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def synthesize_speech(self, text: str, speaker_wav: Optional[str] = None, 
                         language: str = "bn", speed: float = 1.0) -> Dict[str, Any]:
        """Synthesize speech from text"""
        try:
            if not self.tts_model:
                return {
                    "success": False,
                    "error": "No model loaded. Please load a model first."
                }
            
            # Create temporary file for output
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = temp_file.name
            
            try:
                # Synthesize speech
                if speaker_wav and os.path.exists(speaker_wav):
                    # Clone voice from speaker wav
                    self.tts_model.tts_to_file(
                        text=text,
                        speaker_wav=speaker_wav,
                        language=language,
                        file_path=temp_path,
                        speed=speed
                    )
                else:
                    # Use default voice
                    if hasattr(self.tts_model, 'speakers') and self.tts_model.speakers:
                        # Multi-speaker model - use first speaker
                        self.tts_model.tts_to_file(
                            text=text,
                            speaker=self.tts_model.speakers[0],
                            language=language,
                            file_path=temp_path,
                            speed=speed
                        )
                    else:
                        # Single speaker model
                        self.tts_model.tts_to_file(
                            text=text,
                            language=language,
                            file_path=temp_path,
                            speed=speed
                        )
                
                # Read the generated audio file
                with open(temp_path, "rb") as audio_file:
                    audio_data = audio_file.read()
                
                # Encode as base64 for JSON transport
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                
                return {
                    "success": True,
                    "audio_data": audio_base64,
                    "audio_length": len(audio_data),
                    "text_length": len(text),
                    "language": language,
                    "speaker_wav": speaker_wav
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to synthesize speech: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the currently loaded model"""
        if not self.tts_model:
            return {
                "success": False,
                "error": "No model loaded"
            }
        
        return {
            "success": True,
            "model_info": self.model_info
        }
    
    def unload_model(self) -> Dict[str, Any]:
        """Unload the current model to free memory"""
        try:
            if self.tts_model:
                del self.tts_model
                self.tts_model = None
                self.current_model_path = None
                self.model_info = {}
                
                # Force garbage collection
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                return {
                    "success": True,
                    "message": "Model unloaded successfully"
                }
            else:
                return {
                    "success": True,
                    "message": "No model was loaded"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to unload model: {str(e)}"
            }
    
    def list_available_models(self) -> Dict[str, Any]:
        """List available pre-trained models"""
        try:
            manager = ModelManager()
            models = manager.list_models()
            
            # Filter for Bangla models
            bangla_models = [
                model for model in models 
                if 'bn' in model.lower() or 'bangla' in model.lower() or 'bengali' in model.lower()
            ]
            
            return {
                "success": True,
                "all_models": models[:20],  # Limit to first 20 for brevity
                "bangla_models": bangla_models,
                "total_models": len(models)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to list models: {str(e)}"
            }

def main():
    """Main loop for handling requests from Node.js"""
    bridge = CoquiTTSBridge()
    
    # Send ready signal
    print(json.dumps({
        "id": "ready",
        "success": True,
        "message": "Coqui TTS bridge ready",
        "device": bridge.device
    }), flush=True)
    
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
                
            try:
                request = json.loads(line)
                request_id = request.get("id", "unknown")
                method = request.get("method", "")
                params = request.get("params", {})
                
                # Route the request to appropriate method
                if method == "load_model":
                    result = bridge.load_model(**params)
                elif method == "synthesize_speech":
                    result = bridge.synthesize_speech(**params)
                elif method == "get_model_info":
                    result = bridge.get_model_info()
                elif method == "unload_model":
                    result = bridge.unload_model()
                elif method == "list_available_models":
                    result = bridge.list_available_models()
                else:
                    result = {
                        "success": False,
                        "error": f"Unknown method: {method}"
                    }
                
                # Send response
                response = {
                    "id": request_id,
                    "success": result.get("success", False),
                    "result": result if result.get("success") else None,
                    "error": result.get("error") if not result.get("success") else None
                }
                
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                print(json.dumps({
                    "id": "parse_error",
                    "success": False,
                    "error": f"Failed to parse JSON: {str(e)}"
                }), flush=True)
            except Exception as e:
                print(json.dumps({
                    "id": request.get("id", "unknown") if 'request' in locals() else "unknown",
                    "success": False,
                    "error": f"Unexpected error: {str(e)}",
                    "traceback": traceback.format_exc()
                }), flush=True)
                
    except KeyboardInterrupt:
        print(json.dumps({
            "id": "shutdown",
            "success": True,
            "message": "Coqui TTS bridge shutting down"
        }), flush=True)
    except Exception as e:
        print(json.dumps({
            "id": "fatal_error",
            "success": False,
            "error": f"Fatal error: {str(e)}",
            "traceback": traceback.format_exc()
        }), flush=True)

if __name__ == "__main__":
    main()