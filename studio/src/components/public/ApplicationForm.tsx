'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';

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
  phone: string;
  etransfer_email: string;
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
  phone: '',
  etransfer_email: '',
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

  if (name === 'etransfer_email' && trimmed) {
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
  if (!file) return undefined;
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
      if (deckFile) formData.append('deck_file', deckFile);

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
      <div
        role="status"
        className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-green-400"
      >
        {SUCCESS_MESSAGE}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Founder Application</h1>
        <p className="text-default-500 mt-1">Apply to pitch at Aurrin events.</p>
      </div>

      <Input
        id="full_name"
        name="full_name"
        label="Full name"
        value={values.full_name}
        onChange={(e) => setValues((prev) => ({ ...prev, full_name: e.target.value }))}
        onBlur={() => onBlur('full_name')}
        isRequired
        isInvalid={!!errors.full_name}
        errorMessage={errors.full_name}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        value={values.email}
        onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
        onBlur={() => onBlur('email')}
        isRequired
        isInvalid={!!errors.email}
        errorMessage={errors.email}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="company_name"
        name="company_name"
        label="Company name"
        value={values.company_name}
        onChange={(e) => setValues((prev) => ({ ...prev, company_name: e.target.value }))}
        onBlur={() => onBlur('company_name')}
        isRequired
        isInvalid={!!errors.company_name}
        errorMessage={errors.company_name}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <div className="grid gap-1.5">
        <label htmlFor="pitch_summary" className="text-sm text-foreground">
          Pitch summary (100-1000 chars) <span className="text-danger">*</span>
        </label>
        <textarea
          id="pitch_summary"
          name="pitch_summary"
          value={values.pitch_summary}
          onChange={(e) => setValues((prev) => ({ ...prev, pitch_summary: e.target.value }))}
          onBlur={() => onBlur('pitch_summary')}
          minLength={100}
          maxLength={1000}
          required
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[120px] resize-y"
        />
        <p className="text-xs text-default-400">{pitchLength}/1000</p>
        {errors.pitch_summary && <p role="alert" className="text-danger text-sm">{errors.pitch_summary}</p>}
      </div>

      <Input
        id="industry"
        name="industry"
        label="Industry"
        value={values.industry}
        onChange={(e) => setValues((prev) => ({ ...prev, industry: e.target.value }))}
        onBlur={() => onBlur('industry')}
        isRequired
        isInvalid={!!errors.industry}
        errorMessage={errors.industry}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="stage"
        name="stage"
        label="Stage"
        value={values.stage}
        onChange={(e) => setValues((prev) => ({ ...prev, stage: e.target.value }))}
        onBlur={() => onBlur('stage')}
        isRequired
        isInvalid={!!errors.stage}
        errorMessage={errors.stage}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <div className="grid gap-1.5">
        <label htmlFor="deck_file" className="text-sm text-foreground">
          Pitch deck (PDF, max 50MB, optional)
        </label>
        <input
          id="deck_file"
          name="deck_file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => setDeckFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-violet-500/10 file:px-4 file:py-1 file:text-sm file:font-medium file:text-violet-400 hover:file:bg-violet-500/20"
        />
        {errors.deck_file && <p role="alert" className="text-danger text-sm">{errors.deck_file}</p>}
      </div>

      <Input
        id="website"
        name="website"
        label="Website (optional)"
        value={values.website}
        onChange={(e) => setValues((prev) => ({ ...prev, website: e.target.value }))}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="twitter"
        name="twitter"
        label="Twitter (optional)"
        value={values.twitter}
        onChange={(e) => setValues((prev) => ({ ...prev, twitter: e.target.value }))}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="linkedin"
        name="linkedin"
        label="LinkedIn (optional)"
        value={values.linkedin}
        onChange={(e) => setValues((prev) => ({ ...prev, linkedin: e.target.value }))}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        label="Phone Number (optional)"
        value={values.phone}
        onChange={(e) => setValues((prev) => ({ ...prev, phone: e.target.value }))}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Input
        id="etransfer_email"
        name="etransfer_email"
        type="email"
        label="Preferred E-Transfer Email (optional)"
        value={values.etransfer_email}
        onChange={(e) => setValues((prev) => ({ ...prev, etransfer_email: e.target.value }))}
        onBlur={() => onBlur('etransfer_email')}
        isInvalid={!!errors.etransfer_email}
        errorMessage={errors.etransfer_email}
        variant="bordered"
        classNames={{
          inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
        }}
      />

      <Button
        type="submit"
        color="primary"
        isDisabled={isSubmitting}
        isLoading={isSubmitting}
        className="bg-violet-600 hover:bg-violet-700 max-w-[220px]"
      >
        {isSubmitting ? 'Submitting...' : 'Submit application'}
      </Button>

      {submitError && <p role="alert" className="text-danger text-sm">{submitError}</p>}
    </form>
  );
}
