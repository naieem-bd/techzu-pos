import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Money } from '@/api/types';
import { Input } from '@/components/ui/input';
import { isMoneyInput, normalizeMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

interface OverridePriceInputProps {
  id: string;
  label: string;
  /** Current override from the server; null = none (base price applies). */
  value: Money | null;
  disabled: boolean;
  /** Called only for a real change: a valid new amount, or null to clear the override. */
  onCommit: (next: Money | null) => void;
}

/**
 * Inline price override, saved on blur or Enter; Escape reverts. Empty means "use the base
 * price" (sent as null). The parent re-keys this input on every server value, so the draft
 * always restarts from what the server actually stored.
 */
export const OverridePriceInput = ({
  id,
  label,
  value,
  disabled,
  onCommit,
}: OverridePriceInputProps) => {
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const errorId = `${id}-error`;

  const revert = () => {
    setDraft(value ?? '');
    setError(null);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError(null);
      if (value !== null) onCommit(null);
      return;
    }
    if (!isMoneyInput(trimmed)) {
      setError('Use an amount like 4.50');
      return;
    }
    setError(null);
    // "4.5" and "4.50" are the same price: no request.
    if (value !== null && normalizeMoney(trimmed) === value) return;
    onCommit(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      revert();
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="—"
        value={draft}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('h-9 w-24 px-2.5 text-right', disabled && 'bg-muted')}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
};
