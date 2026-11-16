export type GraphicsQuality = 'lowest' | 'low' | 'high';

export function initialGraphicsQuality(touch: boolean, saved: string | null, highThisSession: boolean): GraphicsQuality {
  if (saved === 'lowest') return 'lowest';
  if (saved === 'low' || saved === 'smooth') return 'low';
  if ((saved === 'high' || saved === 'detailed') && (!touch || highThisSession)) return 'high';
  return touch ? 'lowest' : 'high';
}

export function graphicsPixelRatio(quality: GraphicsQuality, touch: boolean, deviceRatio: number) {
  const cap = quality === 'high' ? (touch ? 1 : 1.6) : quality === 'lowest' || touch ? .75 : 1;
  return Math.min(deviceRatio, cap);
}

export class FrameBudget {
  private slowSeconds = 0;
  constructor(private readonly touch: boolean) {}

  reset() { this.slowSeconds = 0; }

  observe(seconds: number, active: boolean) {
    if (!active || seconds <= 0 || seconds >= .5) {
      this.reset();
      return false;
    }
    const budget = this.touch ? .024 : .033;
    this.slowSeconds = seconds > budget
      ? this.slowSeconds + seconds
      : Math.max(0, this.slowSeconds - seconds);
    if (this.slowSeconds < 3) return false;
    this.reset();
    return true;
  }
}
