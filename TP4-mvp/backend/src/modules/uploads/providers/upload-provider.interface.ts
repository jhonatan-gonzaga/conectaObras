import { Request } from 'express';

export type UploadType = 'image' | 'audio';

export interface UploadResponse {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

/** Adapter contract for the infrastructure that persists uploaded files. */
export interface UploadProvider {
  buildResponse(
    file: Express.Multer.File,
    type: UploadType,
    request: Request,
  ): UploadResponse;
}

export const UPLOAD_PROVIDER = Symbol('UPLOAD_PROVIDER');
