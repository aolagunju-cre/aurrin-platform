'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RoleAssignmentModal } from '../../../../components/admin/RoleAssignmentModal';
import { toRoleLabel } from '../../../../lib/admin/roles';

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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Roles</h1>
        <button type="button" onClick={() => setShowAssignModal(true)} disabled={isAssigning}>
          Assign Role
        </button>
      </div>

      {showAssignModal ? (
        <RoleAssignmentModal
          onClose={() => setShowAssignModal(false)}
          onSubmit={assignRole}
          isSubmitting={isAssigning}
        />
      ) : null}

      {error ? (
        <p role="alert" style={{ color: '#b00', margin: 0 }}>
          {error}
        </p>
      ) : null}

      {isLoading ? <p>Loading role assignments...</p> : null}

      {!isLoading ? (
        <table aria-label="Role Assignments Table" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th align="left">User</th>
              <th align="left">Role</th>
              <th align="left">Scope</th>
              <th align="left">Assigned By</th>
              <th align="left">Assigned At</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orderedAssignments.map((assignment) => (
              <tr key={assignment.id}>
                <td>{assignment.user ? `${assignment.user.name ?? 'Unknown'} (${assignment.user.email})` : 'Unknown user'}</td>
                <td>{toRoleLabel(assignment.role)}</td>
                <td>{assignment.scope === 'global' ? 'global' : `${assignment.scope}:${assignment.scoped_id ?? 'n/a'}`}</td>
                <td>{assignment.assigned_by?.email ?? 'System'}</td>
                <td>{new Date(assignment.assigned_at).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void revokeRole(assignment)}
                    disabled={isRevokingId === assignment.id}
                  >
                    {isRevokingId === assignment.id ? 'Revoking...' : 'Revoke Role'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
