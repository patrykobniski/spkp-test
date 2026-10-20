import { useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
  enterKeyHint?: "done" | "next" | "go" | "enter";
  onCommit: (value: string) => void;
};

/**
 * Mobile-first input: local draft while typing (no parent re-render mid-key),
 * 16px font (no iOS zoom), commit on blur / Enter.
 */
export function MobileField({
  label,
  value,
  placeholder,
  inputMode = "text",
  enterKeyHint = "done",
  onCommit,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  function commit(next: string) {
    setDraft(next);
    if (next !== value) onCommit(next);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="mobile-input"
        type="text"
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          focused.current = false;
          commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
