# Lepak LRT

Two synchronized four-car trains circle an elevated guideway through eight stations. The white/red trains, dark cab glazing, blue seats, yellow grab poles, platform safety lines and canopies are inspired by Malaysian Rapid KL LRT. This is a stylized model and a fictional route adapted to the existing game city, not a surveyed reproduction of the real railway.

Stations: KLCC, Ampang Park, TRX, Mamak Timur, Busking Sentral, Mamak Maju, Rembayung, Zoo & Kampung. Search LRT in the city map; teleport destinations lead to the ground-level station entrance. Nearby entrances offer Naik LRT when doors are open, otherwise show the next available boarding countdown. Boarding uses the station entrance/lift transition; there is no free-roaming platform or carriage movement yet.

Each train has 24 reserved passenger slots. The server validates proximity, doors, existing vehicle/chair/dance state and seat availability. The server controls passenger coordinates throughout the ride. Only an open station permits exit. Clients use the same route and a server clock offset, with carriages following different points around curves. Cars, teleport, stunts and driving controls are unavailable aboard; chat and profiles remain available.

Route and timetable: shared/lrt.mjs. Rendering: src/lrt.ts. Server passenger handling: server/lrt.mjs. Stations appear as map entries 33–40. Infrastructure is instanced; distant station/train models are culled. LRT audio is intentionally absent pending the user's sound files.

Reference: https://myrapid.com.my/bus-train/rapid-kl/lrt/

Checks: npm run build; npx playwright test tests/lrt.spec.ts tests/fleet.spec.ts tests/teleport.spec.ts --trace=off. Browser tests cover desktop and 390px layouts, station boarding, disabled mid-journey exit and alighting at the next station. Unit tests cover route continuity, timetables and server ownership of passenger seats.
