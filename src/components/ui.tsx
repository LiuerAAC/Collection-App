import { PropsWithChildren, ReactNode } from "react";

export function Screen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <div className="screen" data-title={title} data-subtitle={subtitle}>{children}</div>
  );
}

export function Section({ title, copy, children }: PropsWithChildren<{ title: string; copy?: string }>) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {copy ? <p className="section-copy">{copy}</p> : null}
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <article className={`card ${className}`.trim()}>{children}</article>;
}

export function Button({ label, onClick, tone = "primary", type = "button" }: { label: string; onClick?: () => void; tone?: "primary" | "quiet" | "danger"; type?: "button" | "submit" }) {
  return (
    <button className={`button ${tone === "primary" ? "" : tone}`.trim()} onClick={onClick} type={type}>
      {label}
    </button>
  );
}

export function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`chip ${active ? "active" : ""}`.trim()} onClick={onClick} type="button">
      {label}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} />
      )}
    </div>
  );
}

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <div>{label}</div>
      {detail ? <div className="muted">{detail}</div> : null}
    </div>
  );
}

export function Row({ children, wrap, between }: PropsWithChildren<{ wrap?: boolean; between?: boolean }>) {
  return <div className={`row ${wrap ? "wrap" : ""} ${between ? "between" : ""}`.trim()}>{children}</div>;
}

export function Stack({ children }: PropsWithChildren) {
  return <div className="stack">{children}</div>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <Card>
      <Stack>
        <strong>{title}</strong>
        <span className="muted">{copy}</span>
        {action}
      </Stack>
    </Card>
  );
}
