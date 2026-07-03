interface FormErrorProps {
  message: string | null | undefined;
}

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <p
      className="border border-destructive bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"
      role="alert"
    >
      {message}
    </p>
  );
}
