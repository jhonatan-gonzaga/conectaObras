import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddProductImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  altText?: string;
}

export class ReorderProductImagesDto {
  @IsArray()
  @IsString({ each: true })
  imageIds: string[];
}

export class SetCoverImageDto {
  @IsString()
  @IsNotEmpty()
  imageId: string;
}
