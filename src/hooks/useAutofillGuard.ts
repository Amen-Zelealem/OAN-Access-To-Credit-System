'use client';
import { useState } from 'react';

// Chrome ignores autoComplete="off" on inputs it recognizes as a login field
// (username/password together) and still offers or silently fills a
// previously-saved credential. Marking the field read-only until it's first
// focused suppresses that, since browsers won't autofill a field they can't
// edit yet — the user can still type normally once they click/tab into it.
export function useAutofillGuard(): [boolean, () => void] {
  const [readOnly, setReadOnly] = useState(true);
  const unlock = () => setReadOnly(false);
  return [readOnly, unlock];
}
