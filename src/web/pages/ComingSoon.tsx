export function ComingSoon({ view }: { view: string }) {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-ink-3">
        {view} view lands in Phase 3. Use <span className="font-medium text-ink-1">List</span> for now.
      </p>
    </div>
  );
}
