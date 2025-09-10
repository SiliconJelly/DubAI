#!/usr/bin/env python3
"""
Mock Python bridge for Coqui TTS integration with Node.js
This is a development/testing version that simulates TTS functionality
without requiring the actual TTS library installation
"""

import sys
import json
import os
import traceback
import tempfile
import base64
import time
from typing import Dict, Any, Optional
from pathlib import Path

class MockCoquiTTSBridge:
    def __init__(self):
        self.current_model_path: Optional[str] = None
        self.model_info: Dict[str, Any] = {}
        self.device = "cpu"  # Mock device
        
    def load_model(self, model_path: str, config_path: Optional[str] = None, 
                   speaker_wav: Optional[str] = None, use_gpu: bool = True) -> Dict[str, Any]:
        """Mock model loading"""
        try:
            # Simulate loading time
            time.sleep(0.1)
            
            # Check if model is already loaded
            if self.current_model_path == model_path:
                return {
                    "success": True,
                    "message": "Model already loaded",
                    "model_info": self.model_info
                }
            
            self.current_model_path = model_path
            
            # Mock model information
            self.model_info = {
                "name": os.path.basename(model_path),
                "path": model_path,
                "device": "cpu",
                "language": "bn" if "bangla" in model_path.lower() or "bn" in model_path.lower() else "multilingual",
                "loaded_at": str(time.time()),
                "speakers": ["default_speaker"],
                "use_gpu": False  # Mock always uses CPU
            }
            
            return {
                "success": True,
                "message": f"Mock model loaded successfully on cpu",
                "model_info": self.model_info
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load mock model: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def synthesize_speech(self, text: str, speaker_wav: Optional[str] = None, 
                         language: str = "bn", speed: float = 1.0) -> Dict[str, Any]:
        """Mock speech synthesis"""
        try:
            if not self.current_model_path:
                return {
                    "success": False,
                    "error": "No model loaded. Please load a model first."
                }
            
            # Simulate processing time based on text length
            processing_time = len(text) * 0.01  # 10ms per character
            time.sleep(min(processing_time, 0.5))  # Cap at 500ms for demo
            
            # Generate mock audio data (sine wave pattern as bytes)
            # This creates a simple pattern that represents audio data
            duration_seconds = len(text) * 0.1  # 100ms per character
            sample_rate = 22050
            samples = int(duration_seconds * sample_rate)
            
            # Create mock audio data (simple pattern)
            mock_audio_data = bytearray()
            for i in range(min(samples, 1000)):  # Limit size for demo
                # Simple pattern that varies with text content
                value = (i + hash(text)) % 256
                mock_audio_data.append(value)
            
            # Encode as base64 for JSON transport
            audio_base64 = base64.b64encode(mock_audio_data).decode('utf-8')
            
            return {
                "success": True,
                "audio_data": audio_base64,
                "audio_length": len(mock_audio_data),
                "text_length": len(text),
                "language": language,
                "speaker_wav": speaker_wav,
                "processing_time": processing_time
            }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to synthesize mock speech: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the currently loaded model"""
        if not self.current_model_path:
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
            if self.current_model_path:
                self.current_model_path = None
                self.model_info = {}
                
                return {
                    "success": True,
                    "message": "Mock model unloaded successfully"
                }
            else:
                return {
                    "success": True,
                    "message": "No model was loaded"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to unload mock model: {str(e)}"
            }
    
    def list_available_models(self) -> Dict[str, Any]:
        """List available pre-trained models (mock)"""
        try:
            # Mock model list
            all_models = [
                "tts_models/multilingual/multi-dataset/xtts_v2",
                "tts_models/en/ljspeech/tacotron2-DDC",
                "tts_models/en/ljspeech/glow-tts",
                "tts_models/bn/custom/bangla-model-v1",
                "tts_models/bn/custom/bangla-model-v2"
            ]
            
            # Filter for Bangla models
            bangla_models = [
                model for model in all_models 
                if 'bn' in model.lower() or 'bangla' in model.lower() or 'bengali' in model.lower()
            ]
            
            return {
                "success": True,
                "all_models": all_models,
                "bangla_models": bangla_models,
                "total_models": len(all_models)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to list mock models: {str(e)}"
            }

def main():
    """Main loop for handling requests from Node.js"""
    bridge = MockCoquiTTSBridge()
    
    # Send ready signal
    print(json.dumps({
        "id": "ready",
        "success": True,
        "message": "Mock Coqui TTS bridge ready (development mode)",
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
            "message": "Mock Coqui TTS bridge shutting down"
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