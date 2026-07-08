interface StatusPillProps {
  children: React.ReactNode;
  tone?: "green" | "red" | "silver";
}

const toneClasses = {
  green: "border-team-sauber text-team-sauber",
  red: "border-f1-red text-f1-white",
  silver: "border-f1-silver text-f1-silver",
};

export function StatusPill({ children, tone = "silver" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex min-h-8 items-center border px-3 text-xs font-bold uppercase ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
