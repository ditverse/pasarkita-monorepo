import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a value.
 * Returns the debounced value which only updates after the specified delay
 * has passed without the value changing.
 *
 * Usage:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 400);
 *   // debouncedSearch updates 400ms after user stops typing
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
