const ROW_INTERACTIVE_SELECTOR = "a,button,input,select,textarea,[data-row-action]";

/** Keep row activation from stealing clicks from controls inside the row. */
export function isInteractiveTarget(target: EventTarget | null) {
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    Boolean(target.closest(ROW_INTERACTIVE_SELECTOR))
  );
}
