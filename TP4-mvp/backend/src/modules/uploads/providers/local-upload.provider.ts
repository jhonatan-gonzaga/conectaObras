import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { UPLOAD_CONFIG } from '../upload.config';
import {
  UploadFile,
  UploadProvider,
  UploadResponse,
  UploadType,
} from './upload-provider.interface';

@Injectable()
export class LocalUploadProvider implements UploadProvider {
  private readonly root = resolve(process.cwd(), 'uploads');

  async save(file: UploadFile, type: UploadType, publicBaseUrl: string): Promise<UploadResponse> {
    const { directory } = UPLOAD_CONFIG[type];
    const audioExtensions: Record<string, string> = {
      'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
      'audio/ogg': '.ogg', 'audio/mp4': '.m4a', 'audio/webm': '.webm',
    };
    const extension = type === 'image'
      ? (file.mimetype === 'image/png' ? '.png' : '.jpg')
      : audioExtensions[file.mimetype] ?? '.bin';
    const filename = `${randomUUID()}${extension}`;
    const objectKey = `${directory}/${filename}`;
    const destination = join(this.root, directory);
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, filename), file.buffer, { flag: 'wx' });
    return {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `${publicBaseUrl.replace(/\/$/, '')}/uploads/${objectKey}`,
      objectKey,
    };
  }

  async remove(objectKey: string): Promise<void> {
    const path = resolve(this.root, objectKey);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Chave de upload invalida.');
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
