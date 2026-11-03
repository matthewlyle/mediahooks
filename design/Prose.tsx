export function Prose({ text }: { text: string }) {
  return text.split(/`([^`]+)`/).map((part, i) =>
    i % 2 ? (
      <code key={i} className="pg-code">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
