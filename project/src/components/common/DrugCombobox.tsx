import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchDrugs, type DrugSuggestion } from '../../../utils/api';

interface DrugComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when a suggestion is chosen, rather than merely typed. */
  onSelect?: (suggestion: DrugSuggestion) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Drug name input with suggestions from the interaction dataset.
 *
 * Free text is still allowed -- a prescriber must be able to enter a medicine
 * the dataset has never heard of. But a name picked from this list is one the
 * screening layer can actually grade, so choosing a suggestion is the
 * difference between a graded warning and an unscreened pair. Suggestions are
 * labelled with where they came from for that reason.
 */
export function DrugCombobox({
  value,
  onChange,
  onSelect,
  placeholder = 'Medicine name',
  id,
  className,
}: DrugComboboxProps) {
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Set when a value arrives from the list rather than the keyboard, so the
  // effect below does not immediately re-query for what was just chosen.
  const justSelected = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const listboxId = useMemo(
    () => `${id ?? 'drug'}-suggestions-${Math.random().toString(36).slice(2, 8)}`,
    [id]
  );

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Debounced: a request per keystroke would both hammer the endpoint and
    // deliver results out of order.
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchDrugs(value, 8)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIndex(-1);
        })
        // Autocomplete is an assist, not a gate. If it fails, the field still
        // accepts what was typed.
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const choose = (suggestion: DrugSuggestion) => {
    justSelected.current = true;
    onChange(suggestion.name);
    onSelect?.(suggestion);
    setOpen(false);
    setSuggestions([]);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      // Only swallow Enter when a suggestion is highlighted, so Enter still
      // submits the form in the normal case.
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-card"
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.source}-${suggestion.name}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(suggestion)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left text-sm transition-colors',
                  index === activeIndex ? 'bg-primary-subtle text-primary' : 'hover:bg-surface'
                )}
              >
                <span className="truncate">{suggestion.name}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                    suggestion.source === 'dataset'
                      ? 'bg-primary-subtle text-primary'
                      : 'bg-surface text-muted-foreground'
                  )}
                >
                  {suggestion.source === 'dataset' ? 'In dataset' : 'Patient list'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Announced without stealing focus from the input. */}
      <span className="sr-only" role="status" aria-live="polite">
        {open ? `${suggestions.length} suggestions available` : ''}
      </span>
    </div>
  );
}
