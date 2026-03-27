import { createSpy } from './spy';

export interface StorageBoundaryMock {
  uploadFile: ReturnType<
    typeof createSpy<
      (
        file: File | Buffer,
        bucket: string,
        userId: string,
        options?: Record<string, unknown>
      ) => Promise<{ file_id: string; path: string }>
    >
  >;
  getSignedUrl: ReturnType<
    typeof createSpy<(fileId: string, userId: string, expiresIn?: number) => Promise<string>>
  >;
  deleteFile: ReturnType<typeof createSpy<(fileId: string, userId: string) => Promise<void>>>;
}

export function createStorageBoundaryMock(): StorageBoundaryMock {
  return {
    uploadFile: createSpy(async (_file, bucket, userId) => ({
      file_id: 'file_test_mock',
      path: `${bucket}/${userId}/mock-file`,
    })),
    getSignedUrl: createSpy(async (fileId: string) => `https://storage.test/${fileId}`),
    deleteFile: createSpy(async () => {}),
  };
}

