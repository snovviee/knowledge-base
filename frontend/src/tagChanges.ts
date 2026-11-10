// The tags area's changes, shown on the notes (features/10_note_tags). A renamed tag
// shows its new name; a deleted tag is dropped. Shown at render time, never stored.

// One note's tags with the changes applied, in the alphabetical order they had.
export function applyTagChanges(
  tags: { id: number; name: string }[] | undefined,
  changed: Record<number, string | null>,
): { id: number; name: string }[] {
  return (tags ?? [])
    .filter((tag) => changed[tag.id] !== null)
    .map((tag) => (tag.id in changed && changed[tag.id] !== null ? { id: tag.id, name: changed[tag.id] as string } : tag))
}
