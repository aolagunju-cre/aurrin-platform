'use client';

import { useState } from 'react';
import { ApplicationForm } from '../../../components/public/ApplicationForm';
import { JudgeApplicationForm } from '../../../components/public/JudgeApplicationForm';
import { MentorApplicationForm } from '../../../components/public/MentorApplicationForm';

const roles = [
  { key: 'founder', label: 'Founder' },
  { key: 'judge', label: 'Judge' },
  { key: 'mentor', label: 'Mentor' },
] as const;

type RoleKey = (typeof roles)[number]['key'];

export default function ApplyPage() {
  const [activeRole, setActiveRole] = useState<RoleKey>('founder');

  return (
    <main className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Apply</h1>
        <p className="text-default-500 mt-2">
          Join the Aurrin Ventures community as a founder, judge, or mentor.
        </p>
      </div>

      {/* Role Tabs */}
      <div className="flex justify-center gap-2">
        {roles.map((role) => (
          <button
            key={role.key}
            onClick={() => setActiveRole(role.key)}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeRole === role.key
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'bg-default-100 dark:bg-default-50/10 text-default-600 hover:bg-violet-500/10 hover:text-violet-500'
            }`}
          >
            {role.label}
          </button>
        ))}
      </div>

      {/* Forms */}
      {activeRole === 'founder' && <ApplicationForm />}
      {activeRole === 'judge' && <JudgeApplicationForm />}
      {activeRole === 'mentor' && <MentorApplicationForm />}
    </main>
  );
}
