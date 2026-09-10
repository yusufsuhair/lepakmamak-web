# Porsche Taycan Frozen Berry

`src/taycan.ts` authors a lightweight stylised model from Yusuf's supplied photo: Frozen Berry paint, low curved body, glass canopy, four-point headlights, air curtains, multi-spoke wheels and rear light strip. The paint is a visual approximation of the photo, not a calibrated factory colour.

`createDriveableCar('taycan')` provides the standard vehicle interface, four wheel groups and a hidden seated driver. `carStyles` accepts the style for remote players too.

The `parked-taycan` fleet entry starts at x=-122, z=134 in the Rembayung forecourt. It is parked, unowned and claimable through the existing car action. Deploy the matching shared fleet seed to dev realtime as well as the frontend; a frontend-only deployment cannot make the server recognise the new car ID.

Checks: `npm run build` and `PLAYWRIGHT_PORT=5184 npx playwright test tests/taycan.spec.ts --output=test-results-game-dev-4-taycan`. The tests render the actual model and exercise authoritative claim/release.
