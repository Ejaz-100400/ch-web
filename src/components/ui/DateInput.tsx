import { useEffect, useState } from "react";

// Native <input type="date"> renders its visible text in whatever locale the
// browser/OS is set to (mm/dd/yyyy on a US-locale browser) -- there is no
// HTML/CSS way to force a display format on it. Since this business reads
// and enters dates as dd/mm/yyyy, we mask a plain text input instead so the
// display format is consistent everywhere regardless of the viewer's
// browser locale. The value/onChange contract (yyyy-mm-dd, same as a native
// date input) is unchanged so this drops in wherever type="date" was used.

function isoToDisplay(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string | null {
  const match = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dStr, mStr, yStr] = match;
  const day = Number(dStr);
  const month = Number(mStr);
  const year = Number(yStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${yStr}-${mStr.padStart(2, "0")}-${dStr.padStart(2, "0")}`;
}

function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join("/");
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

export function DateInput({ value, onChange, style, disabled, placeholder, ...rest }: DateInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      disabled={disabled}
      placeholder={placeholder ?? "DD/MM/YYYY"}
      style={style}
      onChange={(ev) => setText(maskDigits(ev.target.value))}
      onBlur={() => {
        if (!text.trim()) {
          if (value) onChange("");
          return;
        }
        const iso = displayToIso(text);
        if (iso) onChange(iso);
        else setText(isoToDisplay(value));
      }}
      {...rest}
    />
  );
}
