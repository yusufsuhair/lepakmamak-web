import { auth, session } from './auth';
import { appearance, appearanceOptions, type Appearance } from './appearance';

type ClothingKey = 'shirt' | 'trousers';

export function savedLook(): Appearance {
  if (session) return appearance(session.user.user_metadata?.appearance);
  try { return appearance(JSON.parse(localStorage.getItem('lepak-wardrobe') || 'null')); } catch { return appearance(null); }
}

export type ClothingCategory = ClothingKey;
export const CLOTHING: {key: ClothingKey; title: string}[] = [{key: 'shirt', title: 'Tops'}, {key: 'trousers', title: 'Bottoms'}];
export const lookLabel = (key: ClothingKey, value: string) =>
  Object.entries(appearanceOptions[key]).find(([, colour]) => colour === value)?.[0] || 'Custom';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
export function drawLook(canvas: HTMLCanvasElement, look: Appearance) {
  const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(0, 4);
  ctx.fillStyle = '#17352c22'; ctx.beginPath(); ctx.ellipse(140, 337, 68, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#203832'; roundRect(ctx, 78, 311, 53, 16, 7); roundRect(ctx, 149, 311, 53, 16, 7);
  ctx.fillStyle = look.trousers; roundRect(ctx, 89, 225, 43, 91, 12); roundRect(ctx, 148, 225, 43, 91, 12);
  ctx.fillStyle = '#ffffff20'; roundRect(ctx, 95, 232, 8, 70, 4); roundRect(ctx, 154, 232, 8, 70, 4);
  ctx.fillStyle = look.skin; roundRect(ctx, 124, 91, 32, 30, 8); roundRect(ctx, 48, 183, 28, 48, 13); roundRect(ctx, 204, 183, 28, 48, 13);
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.moveTo(101, 109); ctx.quadraticCurveTo(140, 128, 179, 109); ctx.lineTo(207, 132); ctx.lineTo(188, 178); ctx.lineTo(184, 235); ctx.lineTo(96, 235); ctx.lineTo(92, 178); ctx.lineTo(73, 132); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff25'; ctx.beginPath(); ctx.moveTo(101, 112); ctx.lineTo(114, 116); ctx.lineTo(107, 222); ctx.lineTo(98, 222); ctx.closePath(); ctx.fill();
  ctx.fillStyle = look.skin; roundRect(ctx, 56, 139, 27, 60, 13); roundRect(ctx, 197, 139, 27, 60, 13);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(140, 67, 43, 48, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  if (look.hairstyle === 'bob') { ctx.beginPath(); ctx.ellipse(140, 57, 49, 51, 0, Math.PI, Math.PI * 2); ctx.fill(); roundRect(ctx, 93, 49, 17, 62, 8); roundRect(ctx, 170, 49, 17, 62, 8); }
  else if (look.hairstyle === 'ponytail') { ctx.beginPath(); ctx.ellipse(140, 47, 44, 35, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(185, 54, 15, 29, -.35, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.ellipse(140, 43, 44, 31, 0, Math.PI, Math.PI * 2); ctx.fill(); roundRect(ctx, 99, 37, 82, 18, 7); }
  ctx.fillStyle = '#22362f'; ctx.beginPath(); ctx.arc(124, 68, 3, 0, Math.PI * 2); ctx.arc(156, 68, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7c4d3f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(140, 79, 10, .18, Math.PI - .18); ctx.stroke();
  ctx.restore();
}

// Where a look is kept: the account when there is one, this browser when there is not.
export async function saveLook(look: Appearance) {
  const accountId = session?.user.id;
  if (!auth) { localStorage.setItem('lepak-wardrobe', JSON.stringify(look)); return; }
  if (!accountId) throw new Error('Please log in again to save your outfit.');
  const {error} = await auth.auth.updateUser({data: {appearance: look}});
  if (error) throw error;
  if (session?.user.id !== accountId) throw new Error('Your session changed. Please open your character screen again.');
}
