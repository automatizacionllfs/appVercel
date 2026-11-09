export default function AvatarJugador({ src, alt = "", className = "", width, height }) {
  if (src) {
    return <img className={className} src={src} alt={alt} width={width} height={height} loading="lazy" />;
  }

  return (
    <svg
      className={`avatar-jugador ${className}`.trim()}
      viewBox="0 0 48 48"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <circle cx="24" cy="16" r="9" fill="currentColor" />
      <path d="M7 43c0-9.4 7.6-16 17-16s17 6.6 17 16H7Z" fill="currentColor" />
    </svg>
  );
}
