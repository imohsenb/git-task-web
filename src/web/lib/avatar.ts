/**
 * Deterministic initials + hue avatar — no images. git-task has no avatar concept,
 * and calling out to Gravatar would leak emails from what's meant to be a
 * self-hosted, offline-capable tool.
 */
export interface AvatarInfo {
  initials: string;
  style: { backgroundColor: string; color: string };
}

export function avatarFor(email: string, name: string | null): AvatarInfo {
  const hue = fnv1a(email) % 360;
  return {
    initials: initialsFor(name, email),
    style: {
      backgroundColor: `oklch(0.93 0.045 ${hue})`,
      color: `oklch(0.45 0.14 ${hue})`,
    },
  };
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash);
}

function initialsFor(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
