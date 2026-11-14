/** A canonical admin href that edits the current query string, keeping every other parameter. */
export function adminSearchHref(
  path: string,
  search: { toString(): string },
  change: (params: URLSearchParams) => void,
) {
  const next = new URLSearchParams(search.toString());
  change(next);
  return `${path}${next.size ? `?${next}` : ""}`;
}
