import { useState, useCallback } from 'react';

/**
 * Auto-dismissing success message hook
 *
 * @param {number} timeout - Dismiss after ms (default 3000)
 * @returns {[string, function]} [message, setMessage]
 */
export function useSuccessMessage(timeout = 3000) {
  const [message, setMessage] = useState('');

  const setSuccess = useCallback((msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), timeout);
  }, [timeout]);

  return [message, setSuccess];
}
