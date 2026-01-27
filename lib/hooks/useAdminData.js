import { useState, useEffect } from 'react';

/**
 * Defensive data fetching hook for admin panels
 *
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {object} { data, loading, error, refetch }
 */
export function useAdminData(endpoint, options = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(endpoint, options);
      const json = await res.json();

      // Defensive: Always ensure array
      if (json?.success) {
        setData(Array.isArray(json.data) ? json.data : []);
      } else {
        setError(json?.error || 'Failed to load data');
        setData([]);
      }
    } catch (err) {
      console.error(`[useAdminData] Error fetching ${endpoint}:`, err);
      setError('Network error. Please try again.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint]);

  return { data, loading, error, refetch: fetchData };
}
