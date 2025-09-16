# File Upload Components

This directory contains a comprehensive set of React components for handling file uploads in the DubAI application. The components support drag-and-drop functionality, file validation, progress tracking, and integration with the backend API.

## Components

### FileUploader
The main upload component with drag-and-drop support.

```tsx
import { FileUploader } from '@/components/upload';

<FileUploader
  onFilesSelected={handleFilesSelected}
  onFileRemove={handleFileRemove}
  uploadedFiles={files}
  maxFiles={2}
  disabled={isUploading}
/>
```

### UploadContainer
A complete upload solution that combines all upload functionality.

```tsx
import { UploadContainer } from '@/components/upload';

<UploadContainer
  onUploadComplete={(fileIds) => console.log('Uploaded:', fileIds)}
  onCreateJob={(videoId, srtId) => console.log('Creating job:', videoId, srtId)}
  title="Upload Your Files"
  description="Upload video and SRT files for dubbing"
  showCreateJobButton={true}
/>
```

### FilePreview
Preview component for uploaded files with video player and SRT viewer.

```tsx
import { FilePreview } from '@/components/upload';

<FilePreview
  file={fileItem}
  onRemove={handleRemove}
/>
```

### ProgressIndicator
Real-time upload progress tracking.

```tsx
import { ProgressIndicator } from '@/components/upload';

<ProgressIndicator
  uploads={uploadProgress}
  showDetails={true}
/>
```

## Hooks

### useFileUpload
Custom hook for managing file upload state and operations.

```tsx
import { useFileUpload } from '@/components/upload';

const {
  files,
  isUploading,
  addFiles,
  removeFile,
  startUpload,
  cancelUpload,
  hasVideoFile,
  hasSrtFile,
  canStartUpload
} = useFileUpload({
  maxFiles: 2,
  onUploadComplete: (fileIds) => console.log('Complete:', fileIds),
  onUploadError: (error) => console.error('Error:', error)
});
```

## Services

### fileUploadService
Service for handling file upload API calls.

```tsx
import { fileUploadService } from '@/components/upload';

// Upload a single file
const fileId = await fileUploadService.uploadFileComplete(file, {
  onProgress: (progress) => console.log(`Progress: ${progress}%`),
  signal: abortController.signal
});

// Upload multiple files
const fileIds = await fileUploadService.uploadMultipleFiles(
  files,
  (fileIndex, progress) => console.log(`File ${fileIndex}: ${progress}%`)
);
```

## Validation

### FileValidator
Comprehensive file validation with support for video and SRT files.

```tsx
import { validateSingleFile, validateFileList } from '@/components/upload';

// Validate a single file
const result = validateSingleFile(file);
if (result.isValid) {
  console.log('File type:', result.type); // 'video' or 'srt'
}

// Validate multiple files
const { validFiles, errors } = validateFileList(files, existingFiles);
```

## Features

- **Drag & Drop**: Intuitive drag-and-drop interface
- **File Validation**: Client-side validation for file types, sizes, and formats
- **Progress Tracking**: Real-time upload progress with speed and time estimates
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **File Preview**: Video player for video files and content viewer for SRT files
- **Mobile Responsive**: Fully responsive design for all device sizes
- **Accessibility**: ARIA labels and keyboard navigation support
- **TypeScript**: Full TypeScript support with comprehensive type definitions

## Supported File Types

### Video Files
- MP4 (.mp4)
- QuickTime (.mov)
- AVI (.avi)
- WebM (.webm)

### Subtitle Files
- SubRip (.srt)

## File Size Limits
- Maximum file size: 500MB per file
- Maximum files: 2 files (1 video + 1 SRT)

## Usage Example

```tsx
import React from 'react';
import { UploadContainer } from '@/components/upload';

export const MyUploadPage: React.FC = () => {
  const handleUploadComplete = (fileIds: string[]) => {
    console.log('Files uploaded successfully:', fileIds);
  };

  const handleCreateJob = (videoFileId?: string, srtFileId?: string) => {
    // Create dubbing job with uploaded files
    console.log('Creating job with:', { videoFileId, srtFileId });
  };

  return (
    <div className="container mx-auto py-8">
      <UploadContainer
        onUploadComplete={handleUploadComplete}
        onCreateJob={handleCreateJob}
        title="Upload Your Media Files"
        description="Upload your video and subtitle files to start dubbing"
      />
    </div>
  );
};
```

## Testing

The components include comprehensive tests using Vitest and React Testing Library:

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## API Integration

The upload components integrate with the backend API through the following endpoints:

- `POST /api/files/upload-url` - Get signed upload URL
- `PUT <signed-url>` - Upload file to storage
- `POST /api/files/:id/complete` - Complete upload registration
- `GET /api/files/:id/download` - Get download URL
- `DELETE /api/files/:id` - Delete file

## Error Handling

The components handle various error scenarios:

- Network errors during upload
- File validation errors
- Server errors
- Upload cancellation
- Authentication errors

All errors are displayed to users with clear, actionable messages.