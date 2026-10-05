/* Hallmark · designed-as-app · design-system: DESIGN.md */
import { useTheme } from "../context/ThemeContext";
import { WitchHatIcon } from "./HalloweenIcons";

export default function AppLogo({
  className = "w-8 h-8",
  alt = "Moodila",
  ...props
}) {
  const { isHalloween } = useTheme();

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      <img
        src="/favicon.png"
        alt={alt}
        draggable={false}
        decoding="async"
        className={`select-none object-contain ${className}`}
        {...props}
      />
      {isHalloween && (
        <span
          className="absolute -top-2.5 -right-2 pointer-events-none select-none transform rotate-12 animate-pumpkin-glow transition-transform duration-fast"
          aria-hidden="true"
        >
          <WitchHatIcon className="w-5 h-5" />
        </span>
      )}
    </span>
  );
}
