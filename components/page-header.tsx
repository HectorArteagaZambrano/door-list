import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-header">
    <div><Link href="/" className="eyebrow">Door List</Link><h1>{title}</h1>
      {description && <p className="support">{description}</p>}
    </div>
    {children}
  </header>;
}
