/** Human-readable labels for people, assets, and select options (UUIDs stay internal). */

export type PersonLike = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  department?: string | null;
};

export function formatPersonName(
  person: PersonLike | null | undefined,
  fallback = 'Unknown'
): string {
  if (!person) return fallback;
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  if (name) {
    return person.department ? `${name} · ${person.department}` : name;
  }
  if (person.email?.trim()) return person.email.trim();
  return fallback;
}

export function formatAssetLabel(asset: {
  name: string;
  asset_tag: string;
}): string {
  return `${asset.name} (${asset.asset_tag})`;
}

const NONE_VALUES = new Set(['', 'NONE', 'NONE_SELECTED']);

/** Resolve a friendly label for a select bound to UUID values. */
export function labelFromOptions<T extends { id: string }>(
  options: T[],
  selectedId: string | null | undefined,
  getLabel: (item: T) => string,
  placeholder = 'Select…'
): string {
  if (!selectedId || NONE_VALUES.has(selectedId)) return placeholder;
  const item = options.find((o) => o.id === selectedId);
  return item ? getLabel(item) : placeholder;
}

export function optionalNoneLabel(
  selectedId: string | null | undefined,
  label: string | undefined,
  noneLabel = 'None'
): string {
  if (!selectedId || NONE_VALUES.has(selectedId)) return noneLabel;
  return label ?? noneLabel;
}
