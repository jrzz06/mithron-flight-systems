"use client";

import { useFormStatus } from "react-dom";

export function OperationalSubmitButton({
  children,
  pendingLabel = "Saving",
  className = "ambient-cta inline-flex w-fit items-center justify-center self-start",
  confirmMessage,
  onClick,
  name,
  value,
  disabled = false
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
  onClick?: () => void;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      aria-live="polite"
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.();
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/55 disabled:cursor-not-allowed disabled:opacity-55`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
