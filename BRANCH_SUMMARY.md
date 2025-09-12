# DubAI Branch Structure Summary

## Repository Status
✅ **Successfully pushed to GitHub**: https://github.com/SiliconJelly/DubAI

## Branch Isolation Complete

### 🌟 **Master Branch**
- **Purpose**: Main development branch with full TTS router implementation
- **Features**: 
  - Complete TypeScript refactor
  - Configuration management system
  - A/B testing between Google Cloud TTS and Coqui TTS
  - Cost tracking and usage metrics
  - Processing pipeline examples

### 🔵 **feature/google-cloud-tts**
- **Purpose**: Google Cloud TTS focused implementation
- **Key Files**:
  - `src/services/GoogleCloudTTSRouter.ts` - Simplified router for Google TTS only
  - `src/services/GoogleTTSService.ts` - Google TTS interface
  - `src/services/GoogleTTSServiceImpl.ts` - Full Google TTS implementation
- **Features**:
  - Quota management and rate limiting
  - Bangla voice configurations optimized for dubbing
  - Error handling with exponential backoff
  - Usage metrics and cost tracking
  - No Coqui TTS dependencies

### 🟠 **feature/coqui-tts-finetuning**
- **Purpose**: Coqui TTS focused implementation with fine-tuning capabilities
- **Key Files**:
  - `src/services/CoquiTTSRouter.ts` - Coqui TTS only router
  - `src/utils/coquiFineTuning.ts` - Fine-tuning management system
  - `src/utils/coqui_tts_training.py` - Python training script
- **Features**:
  - Model loading and caching
  - Fine-tuning workflow management
  - Dataset preparation utilities
  - Model validation and testing
  - Bangla-specific voice configurations
  - Training progress monitoring

## Next Steps for Cross-Platform Movie Context Collection & Dubbing Site

The repository is now ready for your updated spec sheet. The isolated branches provide:

1. **Google Cloud TTS Branch**: Ready for cloud-based deployment with enterprise-grade TTS
2. **Coqui TTS Branch**: Ready for local/self-hosted deployment with custom model training
3. **Master Branch**: Flexible implementation supporting both services

You can now provide the updated pointers for the new cross-platform movie context collection and dubbing site specification.

## Quick Commands

```bash
# Switch to Google Cloud TTS branch
git checkout feature/google-cloud-tts

# Switch to Coqui TTS fine-tuning branch  
git checkout feature/coqui-tts-finetuning

# Return to master
git checkout master
```

## Branch Comparison

| Feature | Master | Google Cloud TTS | Coqui TTS |
|---------|--------|------------------|-----------|
| A/B Testing | ✅ | ❌ | ❌ |
| Google TTS | ✅ | ✅ | ❌ |
| Coqui TTS | ✅ | ❌ | ✅ |
| Fine-tuning | ❌ | ❌ | ✅ |
| Cloud Ready | ✅ | ✅ | ❌ |
| Self-hosted | ✅ | ❌ | ✅ |
| Cost Tracking | ✅ | ✅ | ✅ |