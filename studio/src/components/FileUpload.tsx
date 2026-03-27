'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@heroui/button';
import { Progress } from '@heroui/progress';

export type SupportedBucket = 'pitch-decks' | 'generated-reports' | 'social-assets' | 'exports';

export interface UploadedFile {
  file_id: string;
  path: string;
  signed_url: string;
}

export interface FileUploadProps {
  bucket: SupportedBucket;
  authToken: string;
  onUploadComplete?: (result: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  disabled?: boolean;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage: string | null;
  result: UploadedFile | null;
}

const BUCKET_ACCEPT: Record<SupportedBucket, string> = {
  'pitch-decks': '.pdf,application/pdf',
  'generated-reports': '.pdf,application/pdf',
  'social-assets': '.jpg,.jpeg,.png,image/jpeg,image/png',
  'exports': '.json,.csv,application/json,text/csv',
};

const BUCKET_MAX_SIZE_MB: Record<SupportedBucket, number> = {
  'pitch-decks': 50,
  'generated-reports': 100,
  'social-assets': 5,
  'exports': 100,
};

/**
 * Drag-and-drop file upload component backed by the /api/upload endpoint.
 */
export function FileUpload({
  bucket,
  authToken,
  onUploadComplete,
  onUploadError,
  accept,
  maxSizeMB,
  label = 'Drop a file here, or click to select',
  disabled = false,
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    errorMessage: null,
    result: null,
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resolvedAccept = accept ?? BUCKET_ACCEPT[bucket];
  const resolvedMaxMB = maxSizeMB ?? BUCKET_MAX_SIZE_MB[bucket];

  const handleFile = useCallback(
    async (file: File) => {
      if (state.status === 'uploading') return;

      // Client-side size guard (server also enforces)
      if (file.size > resolvedMaxMB * 1024 * 1024) {
        const msg = `File is too large. Maximum size for this bucket is ${resolvedMaxMB} MB.`;
        setState({ status: 'error', progress: 0, errorMessage: msg, result: null });
        onUploadError?.(msg);
        return;
      }

      setState({ status: 'uploading', progress: 0, errorMessage: null, result: null });

      try {
        if (!authToken.trim()) {
          throw new Error('Upload requires an auth token');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucket);

        // Use XMLHttpRequest for progress tracking
        const uploadResult = await uploadWithProgress(formData, authToken, (progress) => {
          setState((prev) => ({ ...prev, progress }));
        });

        setState({ status: 'success', progress: 100, errorMessage: null, result: uploadResult });
        onUploadComplete?.(uploadResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setState({ status: 'error', progress: 0, errorMessage: msg, result: null });
        onUploadError?.(msg);
      }
    },
    [authToken, bucket, state.status, resolvedMaxMB, onUploadComplete, onUploadError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-uploaded after error
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && state.status !== 'uploading') {
      inputRef.current?.click();
    }
  }, [disabled, state.status]);

  const handleReset = useCallback(() => {
    setState({ status: 'idle', progress: 0, errorMessage: null, result: null });
  }, []);

  const isUploading = state.status === 'uploading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';

  const dropzoneClasses = [
    'rounded-2xl border-2 border-dashed p-8 text-center transition-colors select-none',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    isDragOver
      ? 'border-violet-500 bg-violet-500/5'
      : isError
        ? 'border-danger'
        : isSuccess
          ? 'border-success'
          : 'border-default-300 hover:border-violet-500',
  ].join(' ');

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      data-testid="file-upload-dropzone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={dropzoneClasses}
    >
      <input
        ref={inputRef}
        type="file"
        accept={resolvedAccept}
        className="hidden"
        onChange={handleInputChange}
        data-testid="file-upload-input"
        disabled={disabled}
      />

      {isUploading && (
        <div data-testid="file-upload-progress" className="space-y-3">
          <p className="text-sm text-default-600">Uploading... {state.progress}%</p>
          <Progress
            aria-label="Upload progress"
            value={state.progress}
            color="secondary"
            className="w-full"
          />
        </div>
      )}

      {isSuccess && state.result && (
        <div data-testid="file-upload-success" className="space-y-2">
          <p className="text-success text-sm font-medium">Upload complete!</p>
          <p className="text-xs text-default-400 break-all">
            Path: {state.result.path}
          </p>
          <Button
            size="sm"
            color="default"
            variant="bordered"
            onPress={(e) => { handleReset(); }}
            className="mt-2"
          >
            Upload another
          </Button>
        </div>
      )}

      {isError && (
        <div data-testid="file-upload-error" className="space-y-2">
          <p className="text-danger text-sm">{state.errorMessage}</p>
          <Button
            size="sm"
            color="danger"
            variant="bordered"
            onPress={() => { handleReset(); }}
            className="mt-2"
          >
            Try again
          </Button>
        </div>
      )}

      {!isUploading && !isSuccess && !isError && (
        <div data-testid="file-upload-idle" className="space-y-1">
          <p className="text-sm text-default-600">{label}</p>
          <p className="text-xs text-default-400">
            Max size: {resolvedMaxMB} MB
          </p>
        </div>
      )}
    </div>
  );
}

async function uploadWithProgress(
  formData: FormData,
  authToken: string,
  onProgress: (pct: number) => void
): Promise<UploadedFile> {
  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadedFile;
          resolve(data);
        } catch {
          reject(new Error('Invalid response from upload endpoint'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText) as { error?: string };
          if (err.error) message = err.error;
        } catch {
          // ignore parse errors
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));

    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader(
      'Authorization',
      authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
    );
    xhr.send(formData);
  });
}
