// The Chattr mark: a chat bubble shaped like the letter C.
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
<rect width="64" height="64" rx="16" fill="#4338ca"/>
<path d="M42.1 21.0A15 15 0 1 0 42.1 41.0" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
<path d="M12.5 53L16.5 36L30 45Z" fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round"/>
<circle cx="47.5" cy="31" r="3.6" fill="#fff"/>
    </svg>
  );
}
