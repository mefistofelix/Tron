# GRID//∞ — Living Game Specification

This file is the source of truth for rebuilding or continuing GRID//∞ with another LLM. Keep it aligned with every accepted gameplay, networking, visual, audio, interface, and deployment change. If code and this document disagree, fix both in the same change.

## Product intent

GRID//∞ is a lightweight, open-source, browser-based 3D lightcycle game inspired by the mechanics documented in the Armagetron “The Basics” page and by the black-space, luminous-grid, geometric computer-world language of 1982-era TRON. It must feel immediate, minimal, attractive, readable at speed, mobile-friendly, and playable indefinitely on an unbounded plane.

The canonical implementation is intentionally dependency-light and centered on `index.html`: inline CSS, JavaScript, audio synthesis, WebGL rendering, game simulation, HUD, PWA behavior, and networking UI. `build-worker.mjs` packages that document into the Cloudflare-compatible worker at `dist/server/index.js`. The public Sites deployment is configured by `.openai/hosting.json`.

## Non-negotiable experience

- The world is an infinite plane with no enclosing arena boundary.
- Movement is cardinal: lightcycles turn exactly 90 degrees.
- Every live cycle leaves a translucent luminous wall in its own color.
- Bike and trail colors match; different riders use clearly distinct colors.
- The camera defaults to a useful chase view that shows the player’s own bike and enough surrounding space. Additional close and top-down cameras may remain available.
- The game is continuous. A crash never ends the session merely because only one or zero opponents remain.
- Solo with the AI slider at zero remains fully playable forever.
- Desktop controls: Left/Right or A/D to steer, Space or S to brake, C to change camera, Escape to pause.
- Mobile controls: translucent circular left, right, and brake buttons positioned as overlays without covering critical play space.
- Pause is authoritative and shared with every connected player.
- The PWA remains installable with manifest, favicon/app icon, service worker, standalone display, and mobile safe-area support.

## Movement and Armagetron-style dynamics

- Base speed is approximately 16 world units/second, with a controlled maximum near 43.
- Turning reduces speed slightly. Local turns are applied immediately when a key or touch control is pressed; a roughly 45 ms anti-spam cooldown buffers the latest turn instead of discarding it.
- Braking consumes a rechargeable brake-energy meter and cannot reduce speed below a safe minimum.
- Riding parallel within about 7.5 world units of a finalized wall produces “grind” against both own and other riders’ trails. The effect grows continuously and nearly linearly with proximity, drives visible rear indicators and pitch, and adds roughly `24 × proximity` world units/second² up to the speed cap; it must be clearly perceptible even before the rider is almost touching the wall.
- Parallel-wall filtering compares each wall with the bike’s forward orientation, never with the perpendicular side-probe direction.
- “Rubber” allows a brief, visibly tense approach to a wall before the crash. It must not permit tunneling or crossing.
- Collision tests expand walls once by half the visual thickness plus the cycle radius (currently about 0.465 world units total), then compare the returned forward clearance directly with the swept movement. Never add the cycle radius a second time. AI and humans obey the same collision geometry.
- AI is leashed to the active human/major rider cluster so it does not disappear across the infinite grid, but it must not crowd or deliberately ram the player.
- AI must treat finalized and active trails as solid. It may use the same rubber mechanic but must never visually pass through a wall.

## Trails, corners, and crashes

- A trail segment reaches the exact turn point. Adjacent segments share their endpoint, so the single central translucent wall surfaces meet without a visual or collision gap at a 90-degree corner. Do not render two parallel wall faces: from above that reads as an incorrect double trail.
- The active trail ends at the bike center. A rider’s own finalized trails are fully solid. Collision code exempts only the exact wall ID created at the latest turn, and only while the bike is within about 1.35 units of that junction; it must never use a generic “ignore any nearby own wall” rule.
- Trail-wall height matches the visual bike height: approximately 1.48 world units, not a tall building-sized barrier.
- Walls are slightly transparent, luminous, readable, and never mistaken for the floor circuitry.
- On crash, the cycle explodes and cuts a traversable gap through nearby walls. The opening must be useful but not excessively wide.
- The crashed cycle’s old walls fade after several seconds.
- Other live riders continue moving throughout the death view.
- The local camera slowly orbits the crash point. There is no visible countdown text.
- Respawn occurs after roughly 4.35 seconds near the largest live-rider cluster.
- A spawn candidate must be at least about 11 units from another cycle, about 4.2 units from a wall, outside the forward lane of a moving rider, and have adequate clearance in its chosen direction.
- Respawn grants about 1.15 seconds of trail-free collision protection, indicated by a subtle ring around the bike.

## Bike model

- Bikes must read as lightcycles, not cars or stacked boxes.
- Use two large wheels aligned on the centerline, with twin luminous ring outlines, restrained spokes, a low angular fairing, dark core, luminous side rails, small canopy, and pointed forward silhouette.
- Geometry stays code-native WebGL; do not add heavyweight 3D model dependencies unless the product direction explicitly changes.
- Keep the top of the model near the configured wall height and keep the silhouette legible from chase and top-down views.

## Infinite grid and circuit-board world

- Grid lines are anchored to absolute world coordinates. They must never slide, pop, or change major/minor classification when the camera or bike crosses a chunk boundary.
- Use large, readable 10-unit cells with clearly visible minor lines and substantially brighter 50-unit major lines; the grid must remain legible from both chase and top-down cameras.
- The floor remains dark enough that walls, bikes, and hazards dominate.
- Circuit-board traces are deterministic per fixed 80-unit world tile. Re-entering an area must reproduce the same geometry.
- Traces use right-angle paths and chip-like rectangular pads at floor level.
- Each circuit path carries two bright comet-like electric impulses with a luminous leading point and a roughly 6-unit tail. They move very quickly along the permanent path and visibly follow its 90-degree turns.
- Floor impulses must not resemble a rider, wall, or collision hazard.
- The start screen shows the grid and moving electrical impulses behind the menu. Menu motion uses real elapsed time even before the simulation starts.

## HUD and leaderboard

- The top-left HUD shows speed, brake energy, and rubber.
- The top-right leaderboard lists all active human and AI riders with a miniature bike, color, name, state, and survival score.
- The local rider row is clearly highlighted and labeled “TU”.
- Names are generated automatically from short neon/computer-themed word pairs, saved locally, limited to 18 characters, and editable in real time from the leaderboard or multiplayer dialog.
- Human connection state and AI state must be distinguishable.
- The leaderboard must remain compact at mobile widths and must not collide with touch controls.

## Multiplayer and rooms

- Simulation is host-authoritative; guests send inputs and render snapshots/interpolated positions.
- Do not require manual offer/answer copy-and-paste or a ping-pong exchange of links.
- Automatic peer discovery uses Trystero `0.25.3` over its default decentralized Nostr strategy, imported from `https://esm.run/trystero@0.25.3`.
- Gameplay data travels through encrypted WebRTC peer connections. Public relays are used only for discovery/signaling.
- Public matchmaking joins the fixed `PUBLIC-01` room. The first rider becomes host; later riders discover it automatically.
- Private rooms use an editable room code and shared key. “Create private” generates missing values and one reusable invitation URL. The key stays in the URL fragment so it is not sent in the HTTP request.
- Opening a private invitation URL auto-fills and joins the room without a return link.
- Maximum human count is controlled by the host’s slider, currently 2–6. Excess riders receive a clear “room full” state.
- If no host is found after a short discovery window, the local peer becomes host. Simultaneous hosts resolve deterministically by peer ID. If a host leaves, remaining peers attempt a deterministic re-election; resetting the authoritative round during migration is acceptable, but the room must remain usable.
- WebRTC can still fail on restrictive networks without TURN. Communicate that limitation honestly; do not claim that “no owned server” means “no external signaling infrastructure”.
- Retain no player accounts, personal data, or central persistent lobby state.

## AI population controls

- AI count is adjustable live from 0 through 6.
- Removing AI removes its cycles and walls immediately, updates the leaderboard, and leaves `state.running` true.
- Adding AI spawns it safely near the human cluster.
- In network play the host owns the AI count and sends the resulting state to guests.

## Audio

- Audio is synthesized with Web Audio: engine, higher-frequency whine, acceleration/grind pitch, turns, sparks/crash noise, and restrained electronic background music.
- Speed and wall proximity raise engine/whine pitch smoothly.
- The original audio lifecycle is retained: solo simulation pauses automatically when its document becomes hidden, while the browser owns the Web Audio context lifecycle for a closed tab.
- Do not add unload, forced suspension, or audio-context shutdown logic solely to compensate for another still-open browser tab.
- Mute preference is device-local.

## Visual and interaction rules

- Dominant palette: black/near-black space, cyan world grid, distinct neon rider accents, restrained magenta/amber secondary cues.
- Keep scanlines and bloom subtle. Readability at speed wins over decoration.
- Avoid visual effects above floor level that could be confused with walls or bikes.
- Menus use crisp geometric panels, thin borders, compact uppercase labels, and no rounded dashboard-card aesthetic.
- Preserve keyboard accessibility labels and visible focus styling.

## Networking and safety invariants

- Only the authoritative host calls the simulation step for a network room.
- Guest input messages are routed to the elected host, not broadcast as authoritative state.
- Host snapshots include names, colors, human/AI flags, position, direction, speed, meters, alive state, trail endpoints, death/respawn timing, invulnerability, scores, walls, pause state, AI count, and human limit.
- A guest accepts authoritative state only from the elected host.
- Names and room codes are sanitized and length-limited before entering state or the DOM.

## Validation checklist

Before publishing any gameplay change:

1. Parse the inline script with Node (`new Function`) and run `git diff --check`.
2. Verify solo with 0 AI remains active after crashes and respawns.
3. Drive repeated left/right squares and confirm there are no corner gaps.
4. Observe multiple AI for several minutes and confirm none crosses a wall.
5. Confirm wall height visually matches the bike.
6. Confirm grid lines remain fixed relative to old walls while crossing several major cells.
7. Confirm electrical paths are fixed, pulses move quickly through their 90-degree turns, and the start-screen background animates.
8. Verify crash camera, silent wait, safe cluster respawn, and invulnerability ring.
9. Test automatic public connection and one-link private connection with two independent browser contexts/devices when possible.
10. Check desktop around 1440×900 and mobile around 390×844, including touch controls and leaderboard.
11. Check browser console for errors, manifest/icon/service-worker endpoints, and audio behavior across play, pause, menu, and tab visibility.
12. Regenerate `dist/server/index.js` with `build-worker.mjs` after every `index.html` change.

## Maintenance rule

Every accepted product decision belongs here. Add the decision to the relevant section, remove superseded behavior rather than accumulating contradictions, and update the validation checklist when a new failure mode is discovered.
