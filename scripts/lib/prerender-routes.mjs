/** Route groups organize files without adding a public URL segment. */
export function hasLiveAppRoute(pattern, appPaths, prerendered) {
  const routes = new Set(Object.keys(appPaths).map((key) => key.replace(/\/\([^/]+\)(?=\/)/g, "")));
  return !prerendered.has(pattern) && routes.has(`${pattern}/page`);
}
