'use client';

import React, { useMemo, useState } from 'react';
import { ROLE_LABELS, ROLE_OPTIONS, SCOPE_OPTIONS, type RoleScopeOption, type UserRoleOption } from '../../lib/admin/roles';

interface SearchUser {
  id: string;
  email: string;
  name: string | null;
}

interface RoleAssignmentModalProps {
  onClose: () => void;
  onSubmit: (payload: {
    user_id: string;
    role: UserRoleOption;
    scope: RoleScopeOption;
    scoped_id: string | null;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function RoleAssignmentModal({ onClose, onSubmit, isSubmitting }: RoleAssignmentModalProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<UserRoleOption>('judge');
  const [scope, setScope] = useState<RoleScopeOption>('global');
  const [scopedId, setScopedId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  async function searchUsers(): Promise<void> {
    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`);
      const payload = await response.json() as { success: boolean; data?: SearchUser[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to search users.');
      }
      setUsers(payload.data ?? []);
      if (payload.data?.length) {
        setSelectedUserId(payload.data[0].id);
      } else {
        setSelectedUserId('');
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Failed to search users.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedUserId) {
      setSubmitError('Select a user before assigning a role.');
      return;
    }

    if (scope !== 'global' && !scopedId.trim()) {
      setSubmitError('Scoped roles require a scope resource id.');
      return;
    }

    setSubmitError(null);
    await onSubmit({
      user_id: selectedUserId,
      role,
      scope,
      scoped_id: scope === 'global' ? null : scopedId.trim(),
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Assign Role" style={{ border: '1px solid #ddd', padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Assign Role</h2>
        <button type="button" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Search user by email
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="email@example.com"
              disabled={isSearching || isSubmitting}
            />
            <button type="button" onClick={() => void searchUsers()} disabled={isSearching || isSubmitting}>
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          User
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={isSubmitting || !users.length}>
            <option value="">Select a user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ? `${user.name} (${user.email})` : user.email}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as UserRoleOption)} disabled={isSubmitting}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as RoleScopeOption)} disabled={isSubmitting}>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {scope !== 'global' ? (
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            Scope Resource ID
            <input
              value={scopedId}
              onChange={(event) => setScopedId(event.target.value)}
              disabled={isSubmitting}
              placeholder="event/founder/subscriber id"
            />
          </label>
        ) : null}

        {selectedUser ? (
          <p style={{ margin: 0 }}>Selected user: {selectedUser.name ? `${selectedUser.name} (${selectedUser.email})` : selectedUser.email}</p>
        ) : null}

        {searchError ? (
          <p role="alert" style={{ color: '#b00', margin: 0 }}>
            {searchError}
          </p>
        ) : null}

        {submitError ? (
          <p role="alert" style={{ color: '#b00', margin: 0 }}>
            {submitError}
          </p>
        ) : null}

        <button type="submit" disabled={isSubmitting || isSearching}>
          {isSubmitting ? 'Assigning...' : 'Assign Role'}
        </button>
      </form>
    </div>
  );
}
