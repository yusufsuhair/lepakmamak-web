export type MissionStage = 'available' | 'delivering' | 'complete';
export const PICKUP = { x: -20, z: 49 };
export const DELIVERY = { x: 0, z: -86 };
export const REWARD = 25;
export class DeliveryMission {
  stage: MissionStage = 'available';
  elapsed = 0;
  completed = 0;
  money = 0;
  constructor(saved?: { money?: number; completed?: number }) {
    this.money = Number.isFinite(saved?.money) ? Math.max(0, Math.floor(saved!.money!)) : 0;
    this.completed = Number.isFinite(saved?.completed) ? Math.max(0, Math.floor(saved!.completed!)) : 0;
  }
  get destination() { return this.stage === 'delivering' ? DELIVERY : PICKUP; }
  interact(distance: number, riding: boolean): 'pickup' | 'delivered' | null {
    if (distance > 4 || riding) return null;
    if (this.stage === 'delivering') {
      this.stage = 'complete';
      this.money += REWARD;
      this.completed++;
      return 'delivered';
    }
    this.stage = 'delivering';
    this.elapsed = 0;
    return 'pickup';
  }
  save() { return { money: this.money, completed: this.completed }; }
}
