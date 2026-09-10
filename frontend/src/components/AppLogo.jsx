/* Hallmark · designed-as-app · design-system: DESIGN.md */
export default function AppLogo({
  className = "w-8 h-8",
  alt = "Moodila",
  ...props
}) {
  return (
    <img
      src="/favicon.png"
      alt={alt}
      draggable={false}
      decoding="async"
      className={`select-none object-contain ${className}`}
      {...props}
    />
  );
}
