import { describe, expect, it } from 'vitest';
import { createLeadSchema } from './lead.schema';

describe('createLeadSchema', () => {
  it('passes a clean E.164-style number through unchanged', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: '+251911000000' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.phoneNumber).toBe('+251911000000');
  });

  it('strips spaces, dashes, and parentheses before validating', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: '+251 (911) 000-000' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.phoneNumber).toBe('+251911000000');
  });

  it('keeps a number without a leading + as digits only', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: '0911 000 000' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.phoneNumber).toBe('0911000000');
  });

  it('rejects a number that is too short even after sanitizing', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: '123' });

    expect(result.success).toBe(false);
  });

  it('rejects a number that is too long even after sanitizing', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: '+2519110000001234567' });

    expect(result.success).toBe(false);
  });

  it('rejects non-numeric input', () => {
    const result = createLeadSchema.safeParse({ phoneNumber: 'not-a-phone-number' });

    expect(result.success).toBe(false);
  });
});
