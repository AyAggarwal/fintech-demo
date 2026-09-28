import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

type Setter = (value: string) => void;

function useSetParam(key: string, resetKeys: readonly string[]): Setter {
  const [, setParams] = useSearchParams();
  return useCallback(
    (value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          for (const resetKey of resetKeys) next.delete(resetKey);
          return next;
        },
        { replace: true },
      );
    },
    [key, resetKeys, setParams],
  );
}

const NO_RESET: readonly string[] = [];

/** URL-backed filter restricted to a known set of options; unknown values are treated as unset. */
export function useUrlEnumParam<T extends string>(key: string, options: readonly T[], resetKeys: readonly string[] = NO_RESET): [T | undefined, Setter] {
  const [params] = useSearchParams();
  const raw = params.get(key);
  const value = options.find((option) => option === raw);
  return [value, useSetParam(key, resetKeys)];
}

/** URL-backed free-text filter. */
export function useUrlTextParam(key: string, resetKeys: readonly string[] = NO_RESET): [string | undefined, Setter] {
  const [params] = useSearchParams();
  const raw = params.get(key);
  return [raw === null || raw === '' ? undefined : raw, useSetParam(key, resetKeys)];
}
