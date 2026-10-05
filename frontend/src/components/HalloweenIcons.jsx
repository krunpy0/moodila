/* Hallmark · designed-as-app · design-system: DESIGN.md */
/**
 * Authored vector SVG icons for Moodila's Halloween Theme.
 * Follows the craft floor: clean vector geometry, consistent weight, no emojis used as icons.
 */

export function JackOLanternIcon({ className = "w-5 h-5", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Stem */}
      <path
        d="M12 2C11.5 3.5 12.2 4.5 12.8 5.2C12.3 5.3 11.7 5.4 11.2 5.5C10.7 4 10.9 2.8 11.8 2.2C12 2.1 12 2 12 2Z"
        fill="#5A7D36"
      />
      {/* Pumpkin Body */}
      <path
        d="M12 5.2C8 5.2 3 7.8 3 13.5C3 19 8 21.5 12 21.5C16 21.5 21 19 21 13.5C21 7.8 16 5.2 12 5.2Z"
        fill="currentColor"
      />
      {/* Pumpkin Rib Lines & Shading (Inner depth) */}
      <path
        d="M12 5.3C9.8 5.3 6.8 7.5 6.8 13.5C6.8 18.5 9.8 21.3 12 21.3C14.2 21.3 17.2 18.5 17.2 13.5C17.2 7.5 14.2 5.3 12 5.3Z"
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.8"
      />
      {/* Left Eye */}
      <polygon
        points="7.5,10.2 9.8,12.2 6.8,12.6"
        fill="rgba(24, 18, 12, 0.95)"
      />
      {/* Right Eye */}
      <polygon
        points="16.5,10.2 17.2,12.6 14.2,12.2"
        fill="rgba(24, 18, 12, 0.95)"
      />
      {/* Nose */}
      <polygon
        points="12,12.2 13,14 11,14"
        fill="rgba(24, 18, 12, 0.95)"
      />
      {/* Jagged Jack-o'-Lantern Smile */}
      <path
        d="M6.5 15.5L8.5 17L10 15.8L12 17.5L14 15.8L15.5 17L17.5 15.5C16.8 18.2 14.2 19.4 12 19.4C9.8 19.4 7.2 18.2 6.5 15.5Z"
        fill="rgba(24, 18, 12, 0.95)"
      />
    </svg>
  );
}

export function CobwebIcon({ className = "w-full h-full", ...props }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Radial Spokes radiating from top-right corner (100, 0) */}
      <line x1="100" y1="0" x2="0" y2="0" />
      <line x1="100" y1="0" x2="0" y2="35" />
      <line x1="100" y1="0" x2="10" y2="70" />
      <line x1="100" y1="0" x2="40" y2="95" />
      <line x1="100" y1="0" x2="75" y2="100" />
      <line x1="100" y1="0" x2="100" y2="100" />

      {/* Outer Web Arc */}
      <path d="M12 0 Q30 18 10 32 Q25 48 18 64 Q46 72 45 92 Q68 85 75 98 Q88 88 100 88" />

      {/* Middle Outer Web Arc */}
      <path d="M36 0 Q52 14 34 24 Q48 38 40 50 Q62 58 64 74 Q80 72 84 82 Q92 74 100 74" />

      {/* Middle Inner Web Arc */}
      <path d="M58 0 Q70 10 56 16 Q68 28 62 36 Q78 44 79 56 Q90 56 92 64 Q96 58 100 58" />

      {/* Inner Web Arc */}
      <path d="M78 0 Q86 6 76 10 Q84 18 80 23 Q90 29 90 38 Q95 38 96 44 Q98 40 100 40" />

      {/* Tiniest Web Arc near Origin */}
      <path d="M90 0 Q94 3 89 5 Q93 9 91 12 Q96 15 96 20 Q98 20 98 24 Q99 22 100 22" />
    </svg>
  );
}

export function BatIcon({ className = "w-6 h-4", ...props }) {
  return (
    <svg
      viewBox="0 0 32 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Elegant Gothic Silhouette Bat */}
      <path d="M16 5.5C15.2 4.2 14.8 2.5 14.2 1C14 2.8 13.6 4.2 13 4.8C10.5 3 6.5 2.5 1 5C3.5 7.8 5 10.8 5.8 13.5C8 11.2 10.5 11.8 12.5 13.2C13.2 10.8 14.5 9.2 15.5 8.8C15.8 10 16 11.5 16 12C16 11.5 16.2 10 16.5 8.8C17.5 9.2 18.8 10.8 19.5 13.2C21.5 11.8 24 11.2 26.2 13.5C27 10.8 28.5 7.8 31 5C25.5 2.5 21.5 3 19 4.8C18.4 4.2 18 2.8 17.8 1C17.2 2.5 16.8 4.2 16 5.5Z" />
    </svg>
  );
}

export function WitchHatIcon({ className = "w-5 h-5", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Hat Cone */}
      <path
        d="M2.5 19.5C6 18.5 18 18.5 21.5 19.5C22 19.7 21 21 12 21C3 21 2 19.7 2.5 19.5Z"
        fill="#241B28"
      />
      {/* Wide Brim */}
      <path
        d="M2 19.8C5.5 18.6 18.5 18.6 22 19.8C20 21.5 4 21.5 2 19.8Z"
        fill="#3A2C40"
      />
      {/* Pointed Cone bending to side */}
      <path
        d="M6 19L11 5.5C11.5 4.2 12.8 3 14.5 3.2C16 3.4 16.5 4.5 15.8 5.8C14.8 7.5 14.2 9.5 14 11.5L18 19H6Z"
        fill="#2C2032"
      />
      {/* Decorative Ribbon Band */}
      <path
        d="M6.8 17.2L7.2 19H16.8L16.2 17.2C14.5 17 9.5 17 6.8 17.2Z"
        fill="#E66A2C"
      />
      {/* Gold/Brass Buckle */}
      <rect
        x="10.8"
        y="16.8"
        width="2.4"
        height="2.4"
        rx="0.4"
        fill="#E8B84B"
      />
    </svg>
  );
}
