interface FormErrorProps {
  message: string | null | undefined;
}

// M10 — the admin guard (withAdminGuard/requireAdminContext) sends a bare
// "Forbidden" for both a CSRF/origin failure and a non-admin role, with no
// guidance for what to do about it. Mapped once here, in the single place
// every admin form's error already renders, rather than in each form's fetch
// handler.
const FRIENDLY_MESSAGES: Record<string, string> = {
  Forbidden: "Action not permitted — check you're signed in as an admin and try again.",
};

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      className="border border-destructive bg-destructive/10 px-3 py-2 text-sm font-bold text-f1-red-text"
      role="alert"
    >
      {FRIENDLY_MESSAGES[message] ?? message}
    </p>
  );
}
