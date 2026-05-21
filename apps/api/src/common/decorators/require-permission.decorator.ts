import { SetMetadata } from '@nestjs/common';
import { ProfilePermissions } from 'src/common/types/request.interface';

export const PERMISSION_KEY = 'requiredPermission';

export const RequirePermission = (permission: keyof ProfilePermissions) =>
  SetMetadata(PERMISSION_KEY, permission);
