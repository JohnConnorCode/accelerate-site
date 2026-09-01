interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  utilityActions?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, subtitle, actions, utilityActions, eyebrow }: PageHeaderProps) {
  return (
    <div className="admin-page-header relative mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className={utilityActions ? "min-w-0 pr-14 sm:pr-0" : "min-w-0"}>
        {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
        <h1 className="admin-page-title">{title}</h1>
        {subtitle && <p className="admin-copy mt-1.5 max-w-2xl text-sm">{subtitle}</p>}
      </div>
      {(utilityActions || actions) && (
        <div className="contents sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
          {utilityActions && (
            <div className="absolute right-0 top-0 flex items-center gap-2 sm:static">
              {utilityActions}
            </div>
          )}
          {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
