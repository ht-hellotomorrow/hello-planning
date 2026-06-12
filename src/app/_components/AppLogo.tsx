type Props = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function AppLogo({
  size = 36,
  showWordmark = true,
  className = "",
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/favicon-b.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md"
        aria-hidden
      />
      {showWordmark && (
        <span className="text-base font-bold tracking-tight">hello planning</span>
      )}
    </div>
  );
}
