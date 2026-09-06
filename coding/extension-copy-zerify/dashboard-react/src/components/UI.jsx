import { AlertTriangle, CheckCircle2, LoaderCircle, Plus, Trash2 } from "lucide-react";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Notice({ type = "info", children }) {
  const Icon = type === "error" ? AlertTriangle : CheckCircle2;
  return <div className={`notice notice--${type}`} role={type === "error" ? "alert" : "status"}><Icon size={18} /> <span>{children}</span></div>;
}

export function LoadingState({ label = "Inhalte werden geladen…" }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={24} /><span>{label}</span></div>;
}

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-state__icon">Z</div><h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}

export function Field({ label, hint, children, className = "" }) {
  return <label className={`field ${className}`}><span className="field__label">{label}</span>{children}{hint && <span className="field__hint">{hint}</span>}</label>;
}

export function Section({ title, description, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel__header">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {action}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function AddButton({ children, onClick }) {
  return <button className="button button--secondary button--small" type="button" onClick={onClick}><Plus size={16} />{children}</button>;
}

export function RemoveButton({ onClick, label = "Eintrag entfernen" }) {
  return <button className="icon-button icon-button--danger" type="button" onClick={onClick} aria-label={label} title={label}><Trash2 size={16} /></button>;
}

export function SkeletonCards() {
  return <div className="skeleton-grid">{[0, 1, 2, 3].map((item) => <div className="skeleton-card" key={item}><span /><span /><span /></div>)}</div>;
}
