/** Pure insertion model shared by pointer and keyboard previews. */
export function moveKanbanItem<T>(
  items: T[],
  activeId: string,
  targetColumn: string,
  overId: string | null,
  after: boolean,
  access: {
    id: (item: T) => string;
    column: (item: T) => string;
    order: (item: T) => number;
    position: (item: T, column: string, order: number) => T;
  },
): T[] {
  const active = items.find((item) => access.id(item) === activeId);
  if (!active || overId === activeId) return items;
  const sourceColumn = access.column(active);
  const sort = (column: string) =>
    items
      .filter((item) => access.column(item) === column && access.id(item) !== activeId)
      .sort((a, b) => access.order(a) - access.order(b));
  const target = sort(targetColumn);
  const anchor = overId ? target.findIndex((item) => access.id(item) === overId) : -1;
  target.splice(
    anchor < 0 ? target.length : anchor + Number(after),
    0,
    access.position(active, targetColumn, 0),
  );
  const positioned = [
    ...(sourceColumn === targetColumn
      ? []
      : sort(sourceColumn).map((item, index) =>
          access.position(item, sourceColumn, (index + 1) * 1000),
        )),
    ...target.map((item, index) => access.position(item, targetColumn, (index + 1) * 1000)),
  ];
  const map = new Map(positioned.map((item) => [access.id(item), item]));
  if (
    items.every((item) => {
      const next = map.get(access.id(item));
      return (
        !next ||
        (access.column(item) === access.column(next) && access.order(item) === access.order(next))
      );
    })
  )
    return items;
  return items.map((item) => map.get(access.id(item)) ?? item);
}
