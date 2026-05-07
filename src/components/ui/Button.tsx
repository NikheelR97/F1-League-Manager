import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 border px-4 py-2 text-sm font-bold uppercase transition-colors";

const buttonVariants = {
  primary: "border-f1-red bg-f1-red text-white hover:bg-white hover:text-f1-black",
  secondary:
    "border-f1-border bg-transparent text-f1-white hover:border-f1-red hover:text-white",
};

export function Button({
  children,
  href,
  icon: Icon,
  variant = "primary",
}: ButtonProps) {
  const className = `${buttonBase} ${buttonVariants[variant]}`;
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={2.5} /> : null}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <button className={className}>{content}</button>;
}
