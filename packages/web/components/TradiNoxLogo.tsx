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
      <circle cx="160" cy="140" r="90" fill="currentColor" />
      <circle cx="320" cy="140" r="90" fill="currentColor" />
      <circle cx="120" cy="360" r="140" fill="currentColor" />
      <circle cx="240" cy="360" r="140" fill="currentColor" />
      <circle cx="360" cy="360" r="140" fill="currentColor" />
    </svg>
  );
}
