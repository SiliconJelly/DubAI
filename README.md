# Automated Dubbing Workflow

A cost-effective micro SaaS solution that transforms English video content into high-quality Bangla dubbed videos using open-source tools and affordable cloud services.

## Features

- **Audio Extraction**: Extract audio from video files using FFmpeg
- **Transcription & Translation**: Use Whisper large-v3 for accurate transcription and translation
- **Dual TTS Support**: Google Cloud TTS (WaveNet) and local Coqui TTS with A/B testing
- **Perfect Synchronization**: Maintain precise timing for lip-sync accuracy
- **Cost Optimization**: Smart routing between cloud and local services
- **Quality Assurance**: Automated quality validation and metrics
- **Scalable Architecture**: Modular design for easy scaling and maintenance

## Prerequisites

- Node.js 18.0.0 or higher
- FFmpeg installed and accessible in PATH
- Python 3.8+ with Whisper installed
- Google Cloud account (optional, for Google TTS)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/automated-dubbing-workflow.git
cd automated-dubbing-workflow
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Google Cloud TTS (optional)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account.json

# File paths
TEMP_DIRECTORY=./temp
OUTPUT_DIRECTORY=./output
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe

# Whisper configuration
WHISPER_MODEL_PATH=./models
PYTHON_PATH=python

# TTS Configuration
ENABLE_AB_TESTING=true
GOOGLE_TTS_WEIGHT=0.5
COQUI_TTS_WEIGHT=0.5
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors
npm run lint:fix
```

## Project Structure

```
src/
├── models/           # Data models and interfaces
├── services/         # Service implementations
├── types/           # TypeScript type definitions
├── utils/           # Utility functions and helpers
└── test/            # Test setup and utilities
```

## API Endpoints

- `POST /api/dubbing` - Submit video for dubbing
- `GET /api/jobs/:id` - Get job status
- `GET /api/jobs/:id/download` - Download completed video
- `GET /api/health` - Health check

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

## License

MIT License - see LICENSE file for details.