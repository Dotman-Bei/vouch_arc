export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="callout">
      <div className="label mb-2">empty</div>
      <h3 className="text-md font-bold mb-2">{title}</h3>
      <p className="text-sm text-fg-secondary mb-4">{body}</p>
      {cta}
    </div>
  );
}
