import { useMeta } from "../../lib/queries";
import { avatarFor } from "../../lib/avatar";

export function TopBar() {
  const { data } = useMeta();
  const identity = data?.data.identity;
  const avatar = identity?.email ? avatarFor(identity.email, identity.name) : null;

  return (
    <header className="h-[64px] shrink-0 border-b border-line flex items-center justify-end px-6">
      {identity && avatar && (
        <div className="flex items-center gap-2 text-sm text-ink-3" title={`committing as ${identity.name} <${identity.email}>`}>
          <span
            className="flex size-6 items-center justify-center rounded-pill text-micro font-semibold"
            style={avatar.style}
          >
            {avatar.initials}
          </span>
          <span className="hidden sm:inline">{identity.name}</span>
        </div>
      )}
    </header>
  );
}
