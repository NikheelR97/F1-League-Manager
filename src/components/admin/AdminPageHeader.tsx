interface AdminPageHeaderProps {
  description?: string;
  title: string;
}

export function AdminPageHeader({ description, title }: AdminPageHeaderProps) {
  return (
    <div className="border-b border-f1-border pb-4">
      <h1 className="text-2xl font-black uppercase text-f1-white">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-f1-muted">{description}</p>
      )}
    </div>
  );
}
