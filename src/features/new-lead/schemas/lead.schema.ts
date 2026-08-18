import { z } from 'zod';

// The backend (A2C Lead.phone_number) always stores/returns a clean
// "+2519xxxxxxxx"-style value — no spaces, dashes, or parentheses (see
// api-flow-backend.md's create_lead examples). The old regex let those
// characters through, so a phone number that passed this validation could
// still be rejected once it reached the backend. Stripping them here means
// what gets validated is exactly what gets submitted.
export const createLeadSchema = z.object({
  phoneNumber: z
    .string()
    .transform((value) => {
      const trimmed = value.trim();
      const digits = trimmed.replace(/\D/g, '');
      return trimmed.startsWith('+') ? `+${digits}` : digits;
    })
    .pipe(
      z
        .string()
        .min(7, 'Phone number is too short')
        .max(15, 'Phone number is too long')
        .regex(/^\+?[0-9]+$/, 'Not a valid phone number format')
    ),
});

export type CreateLeadFormData = z.infer<typeof createLeadSchema>;
