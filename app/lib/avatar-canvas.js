export function dibujarAvatar(ctx, x, y, radio, color = "#C9D8EE") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - radio * 0.28, radio * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - radio * 0.65, y + radio * 0.68);
  ctx.bezierCurveTo(
    x - radio * 0.65,
    y + radio * 0.02,
    x + radio * 0.65,
    y + radio * 0.02,
    x + radio * 0.65,
    y + radio * 0.68,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
