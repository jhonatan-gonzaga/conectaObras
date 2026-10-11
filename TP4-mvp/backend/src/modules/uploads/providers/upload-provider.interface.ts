export type UploadType = 'image' | 'audio';

export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UploadResponse {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  objectKey: string;
}

/** Persists bytes and owns the object key. */
export interface UploadProvider {
  save(file: UploadFile, type: UploadType, publicBaseUrl: string): Promise<UploadResponse>;
  remove(objectKey: string): Promise<void>;
}

export const UPLOAD_PROVIDER = Symbol('UPLOAD_PROVIDER');
