/* The Mahei-Pathap mark: Sangai antlers cradling a fruit (mahei), above a
   Phanek-weave band, on a purple tile with a hard ink shadow. The colours are
   fixed brand values, so they stay literal rather than following theme tokens. */

const INK = "#191919";
const PURPLE = "#7856FF";
const LIME = "#D8F36A";
const SALMON = "#FF927C";
const PAPER = "#FFF8ED";

const BEAMS = [
  "M114 158C88 156 56 140 54 108C52 80 68 58 92 50",
  "M114 158C140 156 172 140 174 108C176 80 160 58 136 50",
];

const TINES = [
  "M60 132C72 130 80 120 82 104",
  "M168 132C156 130 148 120 146 104",
  "M56 88C66 88 74 80 76 66",
  "M172 88C162 88 154 80 152 66",
];

const LEAF = "M114 88C112 79 116 70 126 67C127 77 123 85 114 88Z";

const WEAVE_FULL =
  "M10 208L23 186L36 208L49 186L62 208L75 186L88 208L101 186L114 208L127 186L140 208L153 186L166 208L179 186L192 208L205 186L218 208";
const WEAVE_SIMPLE = "M10 208L62 186L114 208L166 186L218 208";

/* Antlers drawn twice: a wide ink stroke, then a narrower lime stroke on top,
   so overlapping parts share one outline. */
function Antlers({ paths, outline, fill }) {
  return (
    <>
      <g stroke={INK} strokeWidth={outline}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={LIME} strokeWidth={fill}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </>
  );
}

/**
 * @param {object} props
 * @param {number} [props.size]    rendered width and height in px
 * @param {"full"|"simple"} [props.variant]  defaults to "simple" below 64px, where the tines blur
 * @param {boolean} [props.onDark] lime shadow and paper border for ink backgrounds
 * @param {string} [props.className]
 */
export default function BrandMark({ size = 40, variant, className, onDark = false }) {
  const simple = (variant ?? (size < 64 ? "simple" : "full")) === "simple";
  const shadow = onDark ? LIME : INK;
  const border = onDark ? PAPER : INK;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 240 240"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <rect x="22" y="22" width="208" height="208" fill={shadow} />
      <rect x="10" y="10" width="208" height="208" fill={PURPLE} />

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {simple ? (
          <Antlers paths={BEAMS} outline={32} fill={18} />
        ) : (
          <>
            <Antlers paths={BEAMS} outline={22} fill={11} />
            <Antlers paths={TINES} outline={18} fill={7} />
          </>
        )}
      </g>

      {!simple && <path d={LEAF} fill={LIME} stroke={INK} strokeWidth="5" strokeLinejoin="round" />}
      <circle
        cx="114"
        cy={simple ? 112 : 106}
        r={simple ? 22 : 18}
        fill={SALMON}
        stroke={INK}
        strokeWidth={simple ? 8 : 6}
      />

      <rect x="10" y="176" width="208" height="42" fill={INK} />
      <path
        d={simple ? WEAVE_SIMPLE : WEAVE_FULL}
        fill="none"
        stroke={LIME}
        strokeWidth={simple ? 9 : 5}
      />

      <rect
        x="10"
        y="10"
        width="208"
        height="208"
        fill="none"
        stroke={border}
        strokeWidth={simple ? 12 : 8}
      />
    </svg>
  );
}
