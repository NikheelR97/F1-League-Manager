interface RaceFormatTagProps {
  children: React.ReactNode;
}

export function RaceFormatTag({ children }: RaceFormatTagProps) {
  return (
    <span className="inline-flex min-h-8 items-center border-l-4 border-f1-red bg-f1-mid px-3 text-xs font-bold uppercase text-f1-white">
      {children}
    </span>
  );
}
