import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="flex flex-col gap-1.5">
      <h1 className="m-0 text-[26px] font-bold leading-tight text-foreground">{title}</h1>
      {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-end gap-2.5">{actions}</div> : null}
  </div>
);
