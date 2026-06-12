type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export function TodayLine({ className = "", style }: Props) {
  return (
    <div
      aria-hidden
      className={`absolute top-0 bottom-0 w-0.5 bg-brand pointer-events-none z-10 ${className}`}
      style={style}
    />
  );
}
