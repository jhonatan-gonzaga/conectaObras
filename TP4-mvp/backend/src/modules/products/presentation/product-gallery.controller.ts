import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { createUploadOptions } from '../../uploads/upload.config';
import { ProductGalleryService } from '../application/product-gallery.service';
import { AddProductImageDto, ReorderProductImagesDto, SetCoverImageDto } from './product-gallery.dto';

@Controller('store-products/:id/images')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
export class ProductGalleryController {
  constructor(private readonly gallery: ProductGalleryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', createUploadOptions('image')))
  add(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
      @UploadedFile() file: Express.Multer.File, @Body() dto: AddProductImageDto, @Req() request: Request) {
    return this.gallery.add(user.id, id, file, `${request.protocol}://${request.get('host')}`, dto.altText);
  }

  @Patch('order')
  reorder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReorderProductImagesDto) {
    return this.gallery.reorder(user.id, id, dto.imageIds);
  }

  @Patch('cover')
  setCover(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetCoverImageDto) {
    return this.gallery.setCover(user.id, id, dto.imageId);
  }

  @Delete(':imageId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.gallery.remove(user.id, id, imageId);
  }
}
