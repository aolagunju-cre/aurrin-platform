'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RoleAssignmentModal } from '../../../../components/admin/RoleAssignmentModal';
import { toRoleLabel } from '../../../../lib/admin/roles';
import { Button } from '@heroui/button';

interface AssignmentUser {
  id: string;
  email: string;
  name: string | null;
}

interface RoleAssignmentView {
  id: string;
  role: string;
  scope: string;
  scoped_id: string | null;
  assigned_at: string;
  user: AssignmentUser | null;
  assigned_by: AssignmentUser | null;
}

export default function AdminRolesPage(): React.ReactElement {
  const [assignments, setAssignments] = useState<RoleAssignmentView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);

  async function loadAssignments(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/roles');
      const payload = await response.json() as { success: boolean; data?: RoleAssignmentView[]; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load role assignments.');
      }
      setAssignments(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load role assignments.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAssignments();
  }, []);

  const orderedAssignments = useMemo(
    () => [...assignments].sort((left, right) => right.assigned_at.localeCompare(left.assigned_at)),
    [assignments]
  );

  async function assignRole(payload: {
    user_id: string;
    role: 'admin' | 'judge' | 'founder' | 'mentor' | 'subscriber';
    scope: 'global' | 'event' | 'founder' | 'subscriber';
    scoped_id: string | null;
  }): Promise<void> {
    setIsAssigning(true);
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { success: boolean; message?: string; error?: { message?: string } };
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || result.message || 'Failed to assign role.');
      }
      setShowAssignModal(false);
      await loadAssignments();
    } finally {
      setIsAssigning(false);
    }
  }

  async function revokeRole(assignment: RoleAssignmentView): Promise<void> {
    const confirmed = window.confirm(
      `Revoke ${toRoleLabel(assignment.role)} from ${assignment.user?.email ?? 'this user'}?`
    );
    if (!confirmed) {
      return;
    }

    setIsRevokingId(assignment.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/roles/${assignment.id}`, { method: 'DELETE' });
      const result = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to revoke role.');
      }
      await loadAssignments();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke role.');
    } finally {
      setIsRevokingId(null);
    }
  }

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Roles</h1>
        <Button color="secondary" onPress={() => setShowAssignModal(true)} isDisabled={isAssigning}>
          Assign Role
        </Button>
      </div>

      {showAssignModal ? (
        <RoleAssignmentModal
          onClose={() => setShowAssignModal(false)}
          onSubmit={assignRole}
          isSubmitting={isAssigning}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="text-default-400">Loading role assignments...</p> : null}

      {!isLoading ? (
        <div className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 overflow-x-auto">
          <table aria-label="Role Assignments Table" className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">User</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Role</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Scope</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Assigned By</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Assigned At</th>
                <th className="text-left text-default-500 font-medium px-4 py-3 border-b border-default-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedAssignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-default-100/50 transition-colors">
                  <td className="px-4 py-3 border-b border-default-100 text-foreground">{assignment.user ? `${assignment.user.name ?? 'Unknown'} (${assignment.user.email})` : 'Unknown user'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{toRoleLabel(assignment.role)}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{assignment.scope === 'global' ? 'global' : `${assignment.scope}:${assignment.scoped_id ?? 'n/a'}`}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{assignment.assigned_by?.email ?? 'System'}</td>
                  <td className="px-4 py-3 border-b border-default-100 text-default-500">{new Date(assignment.assigned_at).toLocaleString()}</td>
                  <td className="px-4 py-3 border-b border-default-100">
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => void revokeRole(assignment)}
                      isDisabled={isRevokingId === assignment.id}
                    >
                      {isRevokingId === assignment.id ? 'Revoking...' : 'Revoke Role'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
