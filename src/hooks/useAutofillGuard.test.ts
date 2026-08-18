import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAutofillGuard } from './useAutofillGuard';

describe('useAutofillGuard', () => {
  it('starts read-only', () => {
    const { result } = renderHook(() => useAutofillGuard());
    const [readOnly] = result.current;

    expect(readOnly).toBe(true);
  });

  it('becomes editable once unlocked', () => {
    const { result } = renderHook(() => useAutofillGuard());

    act(() => {
      const [, unlock] = result.current;
      unlock();
    });

    const [readOnly] = result.current;
    expect(readOnly).toBe(false);
  });

  it('keeps independent state per field', () => {
    const username = renderHook(() => useAutofillGuard());
    const password = renderHook(() => useAutofillGuard());

    act(() => {
      const [, unlockUsername] = username.result.current;
      unlockUsername();
    });

    expect(username.result.current[0]).toBe(false);
    expect(password.result.current[0]).toBe(true);
  });
});
