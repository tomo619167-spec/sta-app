/** The local origin (0,0) is exactly the graphite tip. */
export function PencilIllustration() {
  return (
    <g
      className="notebook-pencil"
      data-notebook-pencil
      transform="translate(51 46)"
    >
      <path
        d="M0 0 L4 -11 L10 -5 Z"
        fill="var(--surface)"
        stroke="var(--pencil-light)"
        strokeWidth=".6"
      />
      <path d="M0 0 L1.9 -5.1 L4.6 -2.3 Z" fill="var(--foreground)" />
      <path
        d="M4 -11 L23 -33 L29 -27 L10 -5 Z"
        fill="var(--accent)"
        stroke="var(--primary)"
        strokeWidth=".7"
      />
      <path
        d="M7 -8 L26 -30"
        stroke="var(--background)"
        strokeWidth=".7"
        opacity=".65"
      />
      <path
        d="M23 -33 L26 -36 L32 -30 L29 -27 Z"
        fill="var(--surface)"
        stroke="var(--pencil-light)"
        strokeWidth=".6"
      />
    </g>
  );
}
