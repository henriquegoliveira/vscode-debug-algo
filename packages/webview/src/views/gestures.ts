export function overContent(
  target: EventTarget | null,
  box: Element,
  content: Element | null,
): boolean {
  if (target === box) {
    return true;
  }

  return content !== null && target instanceof Node && content.contains(target);
}
