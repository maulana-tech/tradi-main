type TradiNoxLogoProps = {
  size?: number;
  className?: string;
  variant?: "full" | "compact";
  title?: string;
};

export function TradiNoxLogo({
  size = 28,
  className,
  variant = "compact",
  title = "Tradi-Nox",
}: TradiNoxLogoProps) {
  const isFull = variant === "full";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 480 480"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>

      {isFull && (
        <polygon
          points="240,30 450,240 240,450 30,240"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          opacity={0.1}
        />
      )}

      <polygon
        points="240,52 428,240 240,428 52,240"
        fill="none"
        stroke="currentColor"
        strokeWidth={isFull ? 10 : 14}
        strokeLinejoin="miter"
      />

      {isFull && (
        <polygon
          points="240,116 364,240 240,364 116,240"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          opacity={0.32}
        />
      )}

      <rect x="78" y="218" width="324" height="44" fill="currentColor" />

      {isFull && (
        <>
          <rect x="118" y="232" width="62" height="16" fill="#131313" />
          <rect x="208" y="232" width="62" height="16" fill="#131313" />
          <rect x="298" y="232" width="62" height="16" fill="#131313" />
        </>
      )}
    </svg>
  );
}
