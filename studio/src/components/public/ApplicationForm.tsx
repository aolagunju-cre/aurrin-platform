'use client';

import { FormEvent, useMemo, useState } from 'react';

type FormValues = {
  full_name: string;
  email: string;
  company_name: string;
  pitch_summary: string;
  industry: string;
  stage: string;
  website: string;
  twitter: string;
  linkedin: string;
};

type FormErrors = Partial<Record<keyof FormValues | 'deck_file', string>>;

const SUCCESS_MESSAGE = "Application received. We'll review and contact you within 5 business days.";

const initialValues: FormValues = {
  full_name: '',
  email: '',
  company_name: '',
  pitch_summary: '',
  industry: '',
  stage: '',
  website: '',
  twitter: '',
  linkedin: '',
};

function validateField(name: keyof FormValues, value: string): string | undefined {
  const trimmed = value.trim();

  if (['full_name', 'email', 'company_name', 'pitch_summary', 'industry', 'stage'].includes(name) && !trimmed) {
    return 'This field is required';
  }

  if (name === 'email' && trimmed) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Enter a valid email address';
    }
  }

  if (name === 'pitch_summary' && trimmed) {
    if (trimmed.length < 100 || trimmed.length > 1000) {
      return 'Pitch summary must be 100 to 1000 characters';
    }
  }

  return undefined;
}

function validateFile(file: File | null): string | undefined {
  if (!file) return 'Pitch deck is required';
  if (file.type !== 'application/pdf') return 'Pitch deck must be a PDF';
  if (file.size > 50 * 1024 * 1024) return 'Pitch deck must be 50MB or smaller';
  return undefined;
}

export function ApplicationForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const pitchLength = useMemo(() => values.pitch_summary.trim().length, [values.pitch_summary]);

  const onBlur = (field: keyof FormValues) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, values[field]) }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    const nextErrors: FormErrors = {};
    (Object.keys(values) as Array<keyof FormValues>).forEach((field) => {
      const error = validateField(field, values[field]);
      if (error) nextErrors[field] = error;
    });

    const fileError = validateFile(deckFile);
    if (fileError) nextErrors.deck_file = fileError;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      (Object.entries(values) as Array<[keyof FormValues, string]>).forEach(([key, value]) => {
        if (value.trim()) formData.append(key, value.trim());
      });
      formData.append('deck_file', deckFile as File);

      const response = await fetch('/api/public/apply', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json() as {
        success?: boolean;
        message?: string;
        errors?: FormErrors;
      };

      if (!response.ok || !payload.success) {
        setSubmitError(payload.message ?? 'Unable to submit application');
        if (payload.errors) setErrors(payload.errors);
        return;
      }

      setSubmitted(true);
      setValues(initialValues);
      setDeckFile(null);
      setErrors({});
    } catch {
      setSubmitError('Unable to submit application right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" style={{ padding: '1rem', border: '1px solid #0b7a43', borderRadius: 8 }}>
        {SUCCESS_MESSAGE}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>Founder Application</h1>
      <p>Apply to pitch at Aurrin events.</p>

      <label htmlFor="full_name">Full name</label>
      <input
        id="full_name"
        name="full_name"
        value={values.full_name}
        onChange={(e) => setValues((prev) => ({ ...prev, full_name: e.target.value }))}
        onBlur={() => onBlur('full_name')}
        required
      />
      {errors.full_name && <p role="alert">{errors.full_name}</p>}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        value={values.email}
        onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
        onBlur={() => onBlur('email')}
        required
      />
      {errors.email && <p role="alert">{errors.email}</p>}

      <label htmlFor="company_name">Company name</label>
      <input
        id="company_name"
        name="company_name"
        value={values.company_name}
        onChange={(e) => setValues((prev) => ({ ...prev, company_name: e.target.value }))}
        onBlur={() => onBlur('company_name')}
        required
      />
      {errors.company_name && <p role="alert">{errors.company_name}</p>}

      <label htmlFor="pitch_summary">Pitch summary (100-1000 chars)</label>
      <textarea
        id="pitch_summary"
        name="pitch_summary"
        value={values.pitch_summary}
        onChange={(e) => setValues((prev) => ({ ...prev, pitch_summary: e.target.value }))}
        onBlur={() => onBlur('pitch_summary')}
        minLength={100}
        maxLength={1000}
        required
      />
      <p>{pitchLength}/1000</p>
      {errors.pitch_summary && <p role="alert">{errors.pitch_summary}</p>}

      <label htmlFor="industry">Industry</label>
      <input
        id="industry"
        name="industry"
        value={values.industry}
        onChange={(e) => setValues((prev) => ({ ...prev, industry: e.target.value }))}
        onBlur={() => onBlur('industry')}
        required
      />
      {errors.industry && <p role="alert">{errors.industry}</p>}

      <label htmlFor="stage">Stage</label>
      <input
        id="stage"
        name="stage"
        value={values.stage}
        onChange={(e) => setValues((prev) => ({ ...prev, stage: e.target.value }))}
        onBlur={() => onBlur('stage')}
        required
      />
      {errors.stage && <p role="alert">{errors.stage}</p>}

      <label htmlFor="deck_file">Pitch deck (PDF, max 50MB)</label>
      <input
        id="deck_file"
        name="deck_file"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => setDeckFile(e.target.files?.[0] ?? null)}
      />
      {errors.deck_file && <p role="alert">{errors.deck_file}</p>}

      <label htmlFor="website">Website (optional)</label>
      <input
        id="website"
        name="website"
        value={values.website}
        onChange={(e) => setValues((prev) => ({ ...prev, website: e.target.value }))}
      />

      <label htmlFor="twitter">Twitter (optional)</label>
      <input
        id="twitter"
        name="twitter"
        value={values.twitter}
        onChange={(e) => setValues((prev) => ({ ...prev, twitter: e.target.value }))}
      />

      <label htmlFor="linkedin">LinkedIn (optional)</label>
      <input
        id="linkedin"
        name="linkedin"
        value={values.linkedin}
        onChange={(e) => setValues((prev) => ({ ...prev, linkedin: e.target.value }))}
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit application'}
      </button>

      {submitError && <p role="alert">{submitError}</p>}
    </form>
  );
}
