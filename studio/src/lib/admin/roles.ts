export const ROLE_OPTIONS = ['admin', 'judge', 'founder', 'mentor', 'subscriber'] as const;
export type UserRoleOption = typeof ROLE_OPTIONS[number];

export const ROLE_LABELS: Record<UserRoleOption, 'Admin' | 'Judge' | 'Founder' | 'Mentor' | 'Subscriber'> = {
  admin: 'Admin',
  judge: 'Judge',
  founder: 'Founder',
  mentor: 'Mentor',
  subscriber: 'Subscriber',
};

export const SCOPE_OPTIONS = ['global', 'event', 'founder', 'subscriber'] as const;
export type RoleScopeOption = typeof SCOPE_OPTIONS[number];

export function isValidUserRole(value: string): value is UserRoleOption {
  return ROLE_OPTIONS.includes(value as UserRoleOption);
}

export function isValidRoleScope(value: string): value is RoleScopeOption {
  return SCOPE_OPTIONS.includes(value as RoleScopeOption);
}

export function toRoleLabel(role: string): string {
  if (!isValidUserRole(role)) {
    return role;
  }
  return ROLE_LABELS[role];
}

export function validateScopedId(scope: RoleScopeOption, scopedId: string | null): { valid: boolean; message?: string } {
  if (scope === 'global') {
    if (scopedId) {
      return { valid: false, message: 'Global scope must not include scoped_id.' };
    }
    return { valid: true };
  }

  if (!scopedId) {
    return { valid: false, message: `Scope ${scope} requires scoped_id.` };
  }

  return { valid: true };
}
