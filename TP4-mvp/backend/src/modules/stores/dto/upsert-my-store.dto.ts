import { WeekDay } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsLatitude,
  IsLongitude,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class StoreAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  complement?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class StoreOpeningHourDto {
  @IsEnum(WeekDay)
  dayOfWeek: WeekDay;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Horario de abertura deve estar no formato HH:mm.',
  })
  openingTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Horario de fechamento deve estar no formato HH:mm.',
  })
  closingTime?: string | null;

  @IsBoolean()
  closed: boolean;
}

export class UpsertMyStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreAddressDto)
  address?: StoreAddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => StoreOpeningHourDto)
  openingHours?: StoreOpeningHourDto[];
}
