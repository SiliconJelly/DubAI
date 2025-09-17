# MCP Server Configuration Setup

This document explains how to set up the Model Context Protocol (MCP) servers for the DubAI project.

## Overview

The DubAI project uses multiple MCP servers to integrate with external services and handle various processing tasks:

- **OpenSubtitles API**: Subtitle matching and downloading
- **Google TTS Service**: High-quality text-to-speech generation
- **Coqui TTS Local**: Cost-effective local voice generation
- **File Processing**: Video analysis and audio compilation
- **Dailymotion API**: Video downloading and metadata extraction
- **Real-time Streaming**: Live dubbing coordination
- **Whisper Translation**: High-context subtitle translation
- **Database Operations**: Database and caching operations

## Setup Instructions

### 1. Copy MCP Configuration

Copy the MCP server configuration to your Kiro settings:

```bash
# For workspace-level configuration
cp config/mcp-servers.json .kiro/settings/mcp.json

# For user-level configuration (global)
cp config/mcp-servers.json ~/.kiro/settings/mcp.json
```

### 2. Install Required Dependencies

Make sure you have `uv` and `uvx` installed:

```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# uvx is included with uv installation
```

### 3. Set Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Required Environment Variables
OPENSUBTITLES_API_KEY=your_opensubtitles_api_key
GOOGLE_TTS_CREDENTIALS_PATH=/path/to/google-credentials.json
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id
DATABASE_URL=postgresql://user:password@localhost:5432/dubai
REDIS_URL=redis://localhost:6379

# Optional Environment Variables
DAILYMOTION_API_KEY=your_dailymotion_api_key
DAILYMOTION_API_SECRET=your_dailymotion_api_secret
DAILYMOTION_REDIRECT_URI=http://localhost:3000/auth/dailymotion/callback
CUDA_AVAILABLE=false
```

### 4. Obtain API Keys

#### OpenSubtitles.org API Key
1. Register at https://www.opensubtitles.org/
2. Go to https://www.opensubtitles.org/en/consumers
3. Create a new application to get your API key

#### Google Cloud TTS
1. Create a Google Cloud Project
2. Enable the Text-to-Speech API
3. Create a service account and download the JSON credentials file
4. Set the path to the credentials file in `GOOGLE_TTS_CREDENTIALS_PATH`

#### Dailymotion API (Optional)
1. Register at https://developer.dailymotion.com/
2. Create a new application
3. Get your API key and secret

### 5. Test MCP Server Connections

After setting up the configuration, you can test the MCP servers:

1. Open Kiro
2. Go to the MCP Server view in the Kiro feature panel
3. Check that all servers are connected and showing as "Active"
4. Test individual server functions using the MCP tool interface

### 6. Directory Structure

Make sure the following directories exist for caching and temporary files:

```bash
mkdir -p temp cache models/whisper models/coqui cache/translations cache/coqui
```

## Troubleshooting

### Server Connection Issues
- Check that all required environment variables are set
- Verify API keys are valid and have proper permissions
- Ensure `uvx` is installed and accessible in your PATH

### Permission Issues
- Make sure the Google Cloud service account has Text-to-Speech API permissions
- Verify OpenSubtitles API key has download permissions
- Check file system permissions for cache and temp directories

### Performance Issues
- Enable CUDA if you have a compatible GPU: `CUDA_AVAILABLE=true`
- Adjust buffer sizes and timeout values in the configuration
- Monitor resource usage and adjust `maxConcurrentConnections`

## Auto-Approved Functions

The configuration includes auto-approved functions for common operations:
- Subtitle searching and downloading
- Text-to-speech synthesis
- File processing operations
- Video metadata extraction
- Real-time streaming operations

These functions will execute automatically without requiring manual approval in Kiro.

## Security Notes

- Keep your API keys secure and never commit them to version control
- Use environment variables for all sensitive configuration
- Regularly rotate API keys and credentials
- Monitor API usage to detect unauthorized access