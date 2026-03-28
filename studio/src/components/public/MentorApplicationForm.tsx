'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';

type FormValues = {
  full_name: string;
  email: string;
  expertise: string;
  linkedin: string;
  availability: string;
  how_can_help: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const SUCCESS_MESSAGE = "Application received. We'll review and get back to you within 5 business days.";

const initialValues: FormValues = {
  full_name: '',
  email: '',
  expertise: '',
  linkedin: '',
  availability: '',
  how_can_help: '',
};

function validateField(name: keyof FormValues, value: string): string | undefined {
  const trimmed = value.trim();
  if (['full_name', 'email', 'expertise', 'how_can_help'].includes(name) && !trimmed) {
    return 'This field is required';
  }
  if (name === 'email' && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Enter a valid email address';
  }
  if (name === 'how_can_help' && trimmed && trimmed.length < 30) {
    return 'Please provide at least 30 characters';
  }
  return undefined;
}

export function MentorApplicationForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'mentor',
          full_name: values.full_name.trim(),
          email: values.email.trim().toLowerCase(),
          expertise: values.expertise.trim(),
          linkedin: values.linkedin.trim(),
          availability: values.availability.trim(),
          how_can_help: values.how_can_help.trim(),
        }),
      });

      const payload = await res.json() as { success?: boolean; message?: string; errors?: FormErrors };
      if (!res.ok || !payload.success) {
        if (payload.errors) {
          setErrors((prev) => ({ ...prev, ...payload.errors }));
        }
        setSubmitError(payload.message ?? 'Unable to submit application');
        return;
      }

      setSubmitted(true);
    } catch {
      setSubmitError('Unable to submit application right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-green-400">
        {SUCCESS_MESSAGE}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mentor Application</h2>
        <p className="text-default-500 mt-1">Share your experience and help founders navigate their journey.</p>
      </div>

      <Input
        label="Full name"
        value={values.full_name}
        onChange={(e) => setValues((prev) => ({ ...prev, full_name: e.target.value }))}
        onBlur={() => onBlur('full_name')}
        isRequired
        isInvalid={!!errors.full_name}
        errorMessage={errors.full_name}
        variant="bordered"
        classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
      />

      <Input
        type="email"
        label="Email"
        value={values.email}
        onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
        onBlur={() => onBlur('email')}
        isRequired
        isInvalid={!!errors.email}
        errorMessage={errors.email}
        variant="bordered"
        classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
      />

      <Input
        label="Areas of expertise"
        value={values.expertise}
        onChange={(e) => setValues((prev) => ({ ...prev, expertise: e.target.value }))}
        onBlur={() => onBlur('expertise')}
        isRequired
        isInvalid={!!errors.expertise}
        errorMessage={errors.expertise}
        placeholder="e.g. Product-market fit, Fundraising, Technical architecture"
        variant="bordered"
        classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
      />

      <Input
        label="LinkedIn (optional)"
        value={values.linkedin}
        onChange={(e) => setValues((prev) => ({ ...prev, linkedin: e.target.value }))}
        variant="bordered"
        classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
      />

      <Input
        label="Availability (optional)"
        value={values.availability}
        onChange={(e) => setValues((prev) => ({ ...prev, availability: e.target.value }))}
        placeholder="e.g. 2-3 hours/month, weekday evenings"
        variant="bordered"
        classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
      />

      <div className="grid gap-1.5">
        <label htmlFor="how_can_help" className="text-sm text-foreground">
          How can you help founders? <span className="text-danger">*</span>
        </label>
        <textarea
          id="how_can_help"
          value={values.how_can_help}
          onChange={(e) => setValues((prev) => ({ ...prev, how_can_help: e.target.value }))}
          onBlur={() => onBlur('how_can_help')}
          minLength={30}
          required
          placeholder="Describe how your experience and skills could benefit early-stage founders..."
          className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[120px] resize-y"
        />
        {errors.how_can_help && <p role="alert" className="text-danger text-sm">{errors.how_can_help}</p>}
      </div>

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
