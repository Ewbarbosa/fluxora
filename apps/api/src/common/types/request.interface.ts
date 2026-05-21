import { Request } from 'express';

export interface ProfilePermissions {
  canManageAll?: boolean;
  canManageUsers?: boolean;
  canManageFinance?: boolean;
  canViewReports?: boolean;
}

export interface CustomRequest extends Request {
  userId: number;
  tenantId: number;
  permissions?: ProfilePermissions;
}
