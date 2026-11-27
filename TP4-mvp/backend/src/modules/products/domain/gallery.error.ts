export class GalleryError extends Error {
  constructor(public readonly reason: 'NOT_FOUND' | 'LIMIT' | 'ORDER' | 'IMAGE_NOT_FOUND') {
    super(reason);
  }
}
