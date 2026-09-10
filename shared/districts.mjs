// One rule for where you are, shared by the HUD and by the server that stamps chat with it,
// so the district under your name in chat is the same words the HUD shows you.
export function districtFor(z) {
  const north = Number(z);
  if (!Number.isFinite(north)) return 'Kampung Maju';
  return north < -74 ? 'KLCC Park' : north < 9 ? 'Jalan Lepak' : 'Kampung Maju';
}
