// The Saloma Link is the one place in the city with a floor above the ground. The world is
// otherwise flat and solids are two-dimensional, so a plain height field would lift anyone
// on the road below straight up onto the deck. Height therefore depends on whether you
// actually walked up an approach: the ramps are the only way on, and the only way off.
const CENTRE_X = 55, DECK_Z = -125;
const STEPS = 6, STEP_RISE = .58, STEP_RUN = 1.15, STEP_TOP_Y = 3.875, RAMP_START = 24.8;
const RAMP_END = RAMP_START + (STEPS - 1) * STEP_RUN;
const HALF_STEP = STEP_RUN / 2;

export const SALOMA = {
  x: CENTRE_X, z: DECK_Z,
  deckY: 4.44,        // Top of the walkway plate, matching the boxes drawn in world.ts.
  deckHalfLength: 24, // The span itself, before the approaches.
  walkHalfWidth: 2.2, // Inside the railings.
  steps: STEPS, stepRise: STEP_RISE, stepRun: STEP_RUN, stepTopY: STEP_TOP_Y, rampStart: RAMP_START,
  westRampInner: CENTRE_X - RAMP_START,
  westRampOuter: CENTRE_X - RAMP_END,
  eastRampInner: CENTRE_X + RAMP_START,
  eastRampOuter: CENTRE_X + RAMP_END,
};

export function salomaGround(x: number, z: number, elevated: boolean): {y: number; elevated: boolean} {
  const ground = {y: 0, elevated: false};
  if (Math.abs(z - DECK_Z) > SALOMA.walkHalfWidth) return ground;

  const fromCentre = Math.abs(x - CENTRE_X);
  // On an approach: the steps carry you up, and they are what puts you on the bridge.
  if (fromCentre >= RAMP_START - HALF_STEP && fromCentre <= RAMP_END + HALF_STEP) {
    const step = Math.min(STEPS - 1, Math.max(0, Math.round((fromCentre - RAMP_START) / STEP_RUN)));
    // You climb from the bottom step. Reaching the ramp from underneath, where its inner
    // end is high overhead, must not snap you up to the top of the staircase.
    if (!elevated && step !== STEPS - 1) return ground;
    return {y: STEP_TOP_Y - step * STEP_RISE, elevated: true};
  }
  // Over the span: deck height only for someone already up there, so the road stays open.
  if (fromCentre < RAMP_START - HALF_STEP) return elevated ? {y: SALOMA.deckY, elevated: true} : ground;
  return ground;
}
