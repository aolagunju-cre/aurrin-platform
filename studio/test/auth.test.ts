import { extractTokenFromHeader, isTokenExpired, JWTPayload } from '../src/lib/auth/jwt';
import { hasRole, getEffectiveRoles, RoleAssignment } from '../src/lib/auth/session';

describe('Authentication & RBAC - Token Utilities', () => {
  describe('Token Extraction', () => {
    it('should extract token from valid Authorization header', () => {
      const header = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const token = extractTokenFromHeader(header);
      expect(token).toEqual(expect.stringContaining('eyJ'));
    });

    it('should return null for missing Authorization header', () => {
      const token = extractTokenFromHeader(undefined);
      expect(token).toBeNull();
    });

    it('should return null for invalid Authorization header format', () => {
      const token = extractTokenFromHeader('InvalidFormat token');
      expect(token).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const token = extractTokenFromHeader('Basic somebase64string');
      expect(token).toBeNull();
    });
  });

  describe('Token Expiry', () => {
    it('should detect expired tokens', () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload: JWTPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        iat: now - 3600,
        exp: now - 600, // Expired 10 minutes ago
        aud: 'authenticated',
        iss: 'https://project.supabase.co/auth/v1',
      };
      expect(isTokenExpired(expiredPayload)).toBe(true);
    });

    it('should detect valid (non-expired) tokens', () => {
      const now = Math.floor(Date.now() / 1000);
      const validPayload: JWTPayload = {
        sub: 'user-123',
        email: 'user@example.com',
        iat: now,
        exp: now + 3600, // Expires in 1 hour
        aud: 'authenticated',
        iss: 'https://project.supabase.co/auth/v1',
      };
      expect(isTokenExpired(validPayload)).toBe(false);
    });
  });
});

describe('Role-Based Access Control (RBAC)', () => {
  const mockRoleAssignments: RoleAssignment[] = [
    {
      user_id: 'user-123',
      role: 'Judge',
      scope: 'event',
      scoped_id: 'event-456',
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'user-123',
      role: 'Founder',
      scope: 'global',
      scoped_id: null,
      created_at: new Date().toISOString(),
    },
  ];

  const adminRoleAssignments: RoleAssignment[] = [
    {
      user_id: 'admin-user',
      role: 'Admin',
      scope: 'global',
      scoped_id: null,
      created_at: new Date().toISOString(),
    },
  ];

  describe('Basic Role Checks', () => {
    it('should grant access to users with matching role', () => {
      const result = hasRole(mockRoleAssignments, 'Judge');
      expect(result).toBe(true);
    });

    it('should grant access to users with matching role and scope', () => {
      const result = hasRole(mockRoleAssignments, 'Judge', { type: 'event', id: 'event-456' });
      expect(result).toBe(true);
    });

    it('should deny access for mismatched role', () => {
      const result = hasRole(mockRoleAssignments, 'Admin');
      expect(result).toBe(false);
    });

    it('should deny access for role with wrong scope', () => {
      const result = hasRole(mockRoleAssignments, 'Judge', { type: 'event', id: 'event-999' });
      expect(result).toBe(false);
    });

    it('should grant Admin access to all resources', () => {
      const result = hasRole(adminRoleAssignments, 'Judge');
      expect(result).toBe(true);
    });

    it('should grant global role access without scope requirement', () => {
      const result = hasRole(mockRoleAssignments, 'Founder');
      expect(result).toBe(true);
    });

    it('should return false for users with no roles', () => {
      const result = hasRole([], 'Judge');
      expect(result).toBe(false);
    });
  });

  describe('Effective Roles', () => {
    it('should return effective roles for a user', () => {
      const roles = getEffectiveRoles(mockRoleAssignments);
      expect(roles).toHaveLength(2);
      expect(roles[0]).toEqual({
        role: 'Judge',
        scope: 'event',
        scoped_id: 'event-456',
      });
      expect(roles[1]).toEqual({
        role: 'Founder',
        scope: 'global',
        scoped_id: null,
      });
    });

    it('should return empty array for users with no roles', () => {
      const roles = getEffectiveRoles([]);
      expect(roles).toHaveLength(0);
    });
  });

  describe('Role Scoping', () => {
    const scopedRoles: RoleAssignment[] = [
      {
        user_id: 'user-123',
        role: 'Judge',
        scope: 'event',
        scoped_id: 'event-1',
        created_at: new Date().toISOString(),
      },
      {
        user_id: 'user-123',
        role: 'Mentor',
        scope: 'founder',
        scoped_id: 'founder-1',
        created_at: new Date().toISOString(),
      },
      {
        user_id: 'user-123',
        role: 'Subscriber',
        scope: 'subscriber',
        scoped_id: 'tier-1',
        created_at: new Date().toISOString(),
      },
    ];

    it('should match event scope correctly', () => {
      const result = hasRole(scopedRoles, 'Judge', { type: 'event', id: 'event-1' });
      expect(result).toBe(true);
    });

    it('should reject mismatched event scope', () => {
      const result = hasRole(scopedRoles, 'Judge', { type: 'event', id: 'event-2' });
      expect(result).toBe(false);
    });

    it('should match founder scope correctly', () => {
      const result = hasRole(scopedRoles, 'Mentor', { type: 'founder', id: 'founder-1' });
      expect(result).toBe(true);
    });

    it('should reject mismatched founder scope', () => {
      const result = hasRole(scopedRoles, 'Mentor', { type: 'founder', id: 'founder-2' });
      expect(result).toBe(false);
    });

    it('should match subscriber scope correctly', () => {
      const result = hasRole(scopedRoles, 'Subscriber', { type: 'subscriber', id: 'tier-1' });
      expect(result).toBe(true);
    });

    it('should allow access without scope check for global roles', () => {
      const globalRoles: RoleAssignment[] = [
        {
          user_id: 'user-123',
          role: 'Founder',
          scope: 'global',
          scoped_id: null,
          created_at: new Date().toISOString(),
        },
      ];
      const result = hasRole(globalRoles, 'Founder');
      expect(result).toBe(true);
    });
  });

  describe('Multiple Roles per User', () => {
    const multiRoleUser: RoleAssignment[] = [
      {
        user_id: 'user-123',
        role: 'Judge',
        scope: 'event',
        scoped_id: 'event-1',
        created_at: new Date().toISOString(),
      },
      {
        user_id: 'user-123',
        role: 'Founder',
        scope: 'global',
        scoped_id: null,
        created_at: new Date().toISOString(),
      },
      {
        user_id: 'user-123',
        role: 'Mentor',
        scope: 'founder',
        scoped_id: 'founder-2',
        created_at: new Date().toISOString(),
      },
    ];

    it('should support concurrent role assignments', () => {
      expect(hasRole(multiRoleUser, 'Judge')).toBe(true);
      expect(hasRole(multiRoleUser, 'Founder')).toBe(true);
      expect(hasRole(multiRoleUser, 'Mentor')).toBe(true);
      expect(hasRole(multiRoleUser, 'Admin')).toBe(false);
    });

    it('should return all roles in effective roles list', () => {
      const roles = getEffectiveRoles(multiRoleUser);
      expect(roles).toHaveLength(3);
      expect(roles.map((r) => r.role)).toContain('Judge');
      expect(roles.map((r) => r.role)).toContain('Founder');
      expect(roles.map((r) => r.role)).toContain('Mentor');
    });

    it('should allow checking different scopes for same user', () => {
      expect(hasRole(multiRoleUser, 'Judge', { type: 'event', id: 'event-1' })).toBe(true);
      expect(hasRole(multiRoleUser, 'Mentor', { type: 'founder', id: 'founder-2' })).toBe(true);
      expect(hasRole(multiRoleUser, 'Mentor', { type: 'founder', id: 'founder-1' })).toBe(false);
    });
  });

  describe('All Six Roles', () => {
    it('should support Admin role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-1',
          role: 'Admin',
          scope: 'global',
          scoped_id: null,
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Admin')).toBe(true);
      expect(hasRole(roles, 'Judge')).toBe(true); // Admin has all perms
    });

    it('should support Judge role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-2',
          role: 'Judge',
          scope: 'event',
          scoped_id: 'event-123',
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Judge', { type: 'event', id: 'event-123' })).toBe(true);
    });

    it('should support Founder role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-3',
          role: 'Founder',
          scope: 'global',
          scoped_id: null,
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Founder')).toBe(true);
    });

    it('should support Mentor role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-4',
          role: 'Mentor',
          scope: 'founder',
          scoped_id: 'founder-xyz',
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Mentor', { type: 'founder', id: 'founder-xyz' })).toBe(true);
    });

    it('should support Subscriber role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-5',
          role: 'Subscriber',
          scope: 'subscriber',
          scoped_id: 'tier-pro',
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Subscriber', { type: 'subscriber', id: 'tier-pro' })).toBe(true);
    });

    it('should support Audience role', () => {
      const roles: RoleAssignment[] = [
        {
          user_id: 'user-6',
          role: 'Audience',
          scope: 'session',
          scoped_id: 'session-abc',
          created_at: new Date().toISOString(),
        },
      ];
      expect(hasRole(roles, 'Audience', { type: 'session', id: 'session-abc' })).toBe(true);
    });
  });
});
