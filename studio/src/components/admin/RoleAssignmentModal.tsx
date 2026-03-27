'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@heroui/button';
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

const inputClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

const selectClass =
  'w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500';

export function RoleAssignmentModal({ onClose, onSubmit, isSubmitting }: RoleAssignmentModalProps): React.ReactElement {
  const queryInputId = 'role-assignment-query';
  const userSelectId = 'role-assignment-user';
  const roleSelectId = 'role-assignment-role';
  const scopeSelectId = 'role-assignment-scope';
  const scopedIdInputId = 'role-assignment-scoped-id';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal body */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assign Role"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-default-200 bg-background p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Assign Role</h2>
          <Button type="button" color="default" variant="light" size="sm" onPress={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor={queryInputId} className="text-sm font-medium text-default-600">
              Search user by email
            </label>
            <div className="flex gap-2">
              <input
                id={queryInputId}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="email@example.com"
                disabled={isSearching || isSubmitting}
                className={inputClass}
              />
              <Button
                type="button"
                color="default"
                variant="flat"
                onPress={() => void searchUsers()}
                isDisabled={isSearching || isSubmitting}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={userSelectId} className="text-sm font-medium text-default-600">
              User
            </label>
            <select
              id={userSelectId}
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              disabled={isSubmitting || !users.length}
              className={selectClass}
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ? `${user.name} (${user.email})` : user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label htmlFor={roleSelectId} className="text-sm font-medium text-default-600">
                Role
              </label>
              <select
                id={roleSelectId}
                value={role}
                onChange={(event) => setRole(event.target.value as UserRoleOption)}
                disabled={isSubmitting}
                className={selectClass}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={scopeSelectId} className="text-sm font-medium text-default-600">
                Scope
              </label>
              <select
                id={scopeSelectId}
                value={scope}
                onChange={(event) => setScope(event.target.value as RoleScopeOption)}
                disabled={isSubmitting}
                className={selectClass}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {scope !== 'global' ? (
            <div className="grid gap-1.5">
              <label htmlFor={scopedIdInputId} className="text-sm font-medium text-default-600">
                Scope Resource ID
              </label>
              <input
                id={scopedIdInputId}
                value={scopedId}
                onChange={(event) => setScopedId(event.target.value)}
                disabled={isSubmitting}
                placeholder="event/founder/subscriber id"
                className={inputClass}
              />
            </div>
          ) : null}

          {selectedUser ? (
            <p className="text-sm text-default-500">
              Selected user:{' '}
              <span className="font-medium text-foreground">
                {selectedUser.name ? `${selectedUser.name} (${selectedUser.email})` : selectedUser.email}
              </span>
            </p>
          ) : null}

          {searchError ? (
            <p role="alert" className="text-danger text-sm">
              {searchError}
            </p>
          ) : null}

          {submitError ? (
            <p role="alert" className="text-danger text-sm">
              {submitError}
            </p>
          ) : null}

          <div className="pt-2">
            <Button type="submit" color="primary" className="w-full" isDisabled={isSubmitting || isSearching}>
              {isSubmitting ? 'Assigning...' : 'Assign Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
