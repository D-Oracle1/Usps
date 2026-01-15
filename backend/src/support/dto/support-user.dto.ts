import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterSupportUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginSupportUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
