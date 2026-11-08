/** Shared vector-only pencil treatment. Text is never filtered. */
export function PencilDefinitions() {
  return (
    <svg
      className="trace-definitions"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
    >
      <defs>
        <filter id="trace-pencil" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".035"
            numOctaves="2"
            seed="17"
            result="grain"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="grain"
            scale=".65"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
export function BookSketch() {
  return (
    <svg
      className="book-sketch"
      viewBox="0 0 140 94"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth=".85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m22 70 53 13 47-24-54-12-46 23Z M22 70v9l53 12 47-24v-8 M75 83v8 M28 72l46 11 M80 84l34-17 M37 55l53 13 36-21-53-12-36 20Z M37 55v10l53 12 36-21v-9 M90 68v9 M45 59l38 9 M96 70l23-14 M29 35l48 12 43-20L72 15 29 35Z M29 35v13l48 12 43-21V27 M77 47v13 M35 39l36 9 M35 44l36 9 M83 49l29-14 M83 54l28-14 M26 84l42 10 M16 82l39 10" />
        <path
          d="m29 36 47 12 43-20 M39 55l50 12 35-19 M24 71l50 13 46-23"
          opacity=".45"
        />
        <path
          d="m103 84 16-7m-11 9 18-8m-6 6 10-5M55 64l18 4m-17-6 15 4"
          opacity=".45"
        />
      </g>
    </svg>
  );
}
export function PencilUnderline() {
  return (
    <svg
      className="pencil-underline"
      viewBox="0 0 240 17"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 10C61 2 152 4 235 2M9 13C89 5 169 7 239 4M20 14c58-5 110-6 159-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="m8 8 198-6"
        fill="none"
        stroke="currentColor"
        opacity=".35"
        strokeWidth=".8"
      />
    </svg>
  );
}
export function TraceWordmark() {
  return (
    <span className="trace-wordmark">
      TRACE <em>Note</em>
    </span>
  );
}
