import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "h-10 w-full rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none transition placeholder:text-[var(--platform-text-muted)] focus:border-teal-600/30 focus:ring-2 focus:ring-teal-600/10";

const textareaClass =
  "min-h-[96px] w-full rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-primary)] outline-none transition placeholder:text-[var(--platform-text-muted)] focus:border-teal-600/30 focus:ring-2 focus:ring-teal-600/10";

type FormFieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function FormField({ label, hint, children, htmlFor }: FormFieldProps) {
  return (
    <label htmlFor={htmlFor} className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--platform-text-primary)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--platform-text-muted)]">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${textareaClass} ${props.className ?? ""}`} />;
}
