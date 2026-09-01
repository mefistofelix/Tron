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
- Desktop controls: Left/Right or A/D to steer, Down/Space/S to brake, C to change camera, and T to open chat. Enter sends; Escape cancels chat or closes Settings.
- Mobile controls have no visible overlays. A free press in the bottom 17% of the game canvas brakes for as long as the finger remains down. Above that band, a free tap on the left half turns left and a free tap on the right half turns right. Interactive UI such as toolbar, Settings, chat, and a visible leaderboard consumes its own touches without steering or braking.
- Gameplay never exposes a pause action. Solo and online simulations continue while the page is active.
- The PWA remains installable with manifest, favicon/app icon, service worker, standalone display, and mobile safe-area support.

## Movement and Armagetron-style dynamics

- Base speed is approximately 16 world units/second, with a high grind-driven maximum near 82 (about 295 km/h on the HUD).
- Turning reduces speed slightly. Local turns are applied immediately when a key or touch control is pressed; a roughly 45 ms anti-spam cooldown buffers the latest turn instead of discarding it.
- Braking consumes a rechargeable brake-energy meter, decelerates at roughly 23 world units/second², and cannot reduce speed below a safe minimum.
- Riding parallel within about 7.5 world units of a finalized wall produces “grind” against both own and other riders’ trails. The effect remains continuous across the whole range but uses a progressive curve (`0.28t + 0.72t^2.2`) so reducing an already small gap—for example from 2 units to 1—creates a clearly larger acceleration difference. It drives visible rear flames and pitch and adds roughly `28 × proximity` world units/second² up to the speed cap.
- Parallel-wall filtering compares each wall with the bike’s forward orientation, never with the perpendicular side-probe direction.
- “Rubber” allows a brief, visibly tense approach to a wall before the crash. Its stress accumulation is deliberately brisk—roughly 15% faster than the earlier baseline—so a rider cannot remain pressed against a trail. It must not permit tunneling or crossing.
- The HUD rubber percentage represents the remaining elastic anti-collision margin: approaching a perpendicular trail consumes it, and remaining pressed against the trail until it is exhausted causes a crash. Keep a concise explanatory tooltip because the term is intentionally inherited from Armagetron.
- Collision geometry is strictly 2D and zero-thickness: the moving bike is represented by one point on the floor plane and every trail by its mathematical line segment, equivalent to a 1 px collision line. There is no bike radius, wall thickness, bounding volume, or collision against bike models, particles, grid effects, or other decorative geometry.
- A forward swept point tests only trail segments perpendicular to the cast direction. Parallel walls are handled exclusively by lateral grind probes and can be approached arbitrarily closely without collision. Any positive mathematical gap between two parallel trails remains traversable, however narrow.
- AI is leashed to the active human/major rider cluster so it does not disappear across the infinite grid, but it must not crowd or deliberately ram the player.
- AI must treat finalized and active trails as solid. It may use the same rubber mechanic but must never visually pass through a wall.
- AI steering must favor long, readable straight runs. Normal tactical decisions are spaced roughly 1.5–3.6 seconds apart, each AI turn has an additional ~0.38-second anti-zig-zag lock, and aimless turns are rare.
- When the nearest human is roughly 10–58 units away, an AI may occasionally target a predicted point 14–34 units ahead of that rider to lay a cutting trail across the future route. It must still prioritize open space, turn away inside about 6.5 units, and never directly home into the rider.

## Trails, corners, and crashes

- A trail segment reaches the exact turn point. Adjacent segments share their endpoint, so the single central translucent wall surfaces meet without a visual or collision gap at a 90-degree corner. Do not render two parallel wall faces: from above that reads as an incorrect double trail.
- The active trail ends at the bike point. A rider’s own finalized trails are fully solid. Collision code exempts only the exact wall ID created at the latest turn and only for the first roughly 0.12 world units leaving that junction; it must never use a generic “ignore any nearby own wall” rule.
- Trail-wall height matches the visual bike height: approximately 1.48 world units, not a tall building-sized barrier.
- Walls are slightly transparent, luminous, readable, and never mistaken for the floor circuitry.
- On crash, the cycle explodes and cuts a traversable gap through nearby walls. The opening must be useful but not excessively wide.
- By default, crash explosions carve only the local traversable opening and every remaining trail portion persists indefinitely after its rider respawns. A room host may enable “Clear trails on crash”; when enabled, every finalized trail owned by the crashed cycle disappears immediately after the crash gap is processed. Guests and solo players cannot authoritatively change this rule.
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
- Two rear thrust flames remain visible at ordinary speed and become substantially longer and brighter with both absolute speed and positive grind acceleration. Their outer glow follows the rider color and their hot core remains warm and bright.

## Infinite grid and circuit-board world

- Grid lines are anchored to absolute world coordinates. They must never slide, pop, or change major/minor classification when the camera or bike crosses a chunk boundary.
- Use large, readable 10-unit cells with clearly visible minor lines and substantially brighter 50-unit major lines; the grid must remain legible from both chase and top-down cameras.
- The floor remains dark enough that walls, bikes, and hazards dominate.
- Circuit-board traces are deterministic per fixed 80-unit world tile. Re-entering an area must reproduce the same geometry.
- Traces use right-angle paths and chip-like rectangular pads at floor level.
- Each circuit path carries two thin red LED/laser impulses. They move very quickly along the permanent path and visibly follow its 90-degree turns. Each uses a deterministic varied tail length of roughly 3–7 units, segmented alpha that fades toward the rear, and a much brighter hot leading tip. Do not render a separate leading point: isolated WebGL points can look like a stray cursor or targeting reticle near screen center.
- Floor impulses must not resemble a rider, wall, or collision hazard.
- The start screen shows the grid and moving electrical impulses behind the menu. Menu motion uses real elapsed time even before the simulation starts.
- Cull walls by the focus point’s distance to the wall segment, never by distance to the segment midpoint. Long active/finalized walls must remain visible whenever any part of them intersects the render radius.

## HUD and leaderboard

- The top-left HUD shows speed, brake energy, and rubber. It begins near the safe top edge rather than reserving a blank full-width toolbar band; the toolbar occupies only its own top-right footprint.
- The top-right leaderboard lists all active human and AI riders with a miniature bike, color, name, state, and survival score.
- The local rider row is clearly highlighted and labeled “YOU”.
- Names are generated automatically from short neon/computer-themed word pairs, saved locally, limited to 18 characters, and editable from Settings.
- Human connection state and AI state must be distinguishable.
- The leaderboard must remain compact at mobile widths and must not collide with touch controls.
- A north-up minimap sits at bottom-right, centered on the local bike, and shows a relatively wide roughly 230-unit square of the world-fixed grid, nearby finalized/active walls, every live bike in its rider color, and a highlighted local marker. It updates at a restrained rate and uses cheap bounds culling so indefinite wall growth does not add unnecessary per-frame work.
- On touch/mobile layouts the minimap uses the lower safe corner because there are no visible steering or brake overlays.
- The leaderboard contains only rider information; name editing and invitation copying never appear there because Settings and the toolbar already own those actions.
- A Riders toolbar toggle shows or hides the leaderboard. It is hidden by default on small screens, visible by default on larger screens, and the device-local choice persists.
- Online play exposes a direct Invite icon in the top-right toolbar. It copies the current page URL; users never need to see or type a room ID.
- A compact mini-chat sits below the left-side stats. T or the Chat toolbar icon opens writing; the toolbar icon toggles the composer on touch devices, Enter sends, and Escape cancels. The Chat icon is disabled until a playable local cycle is available and reflects its open state. It displays at most the latest six messages and each fades away over roughly nine seconds. Chat is available in solo and multiplayer; online messages are host-relayed, sender identity/color is normalized by the host, and text is whitespace-normalized and capped at 96 characters.

## Multiplayer and rooms

- Simulation is host-authoritative; guests send inputs and render snapshots/interpolated positions.
- Do not require manual offer/answer copy-and-paste or a ping-pong exchange of links.
- Automatic peer discovery uses Trystero `0.25.3` over its default decentralized Nostr strategy, imported from `https://esm.run/trystero@0.25.3`.
- Gameplay data travels through encrypted WebRTC peer connections. Public relays are used only for discovery/signaling.
- Every gameplay room has its own sanitized internal ID. Public IDs are generated as `PUB-XXXXXX`; private IDs are generated as high-entropy `PRI-XXXXXXXXXX` values. The active ID lives in the current page URL fragment and is not presented as a user-facing field.
- Public and private rooms use the same host-authoritative gameplay transport. Their only product-level difference is discoverability: public rooms are advertised to random riders, while private rooms are unlisted and require their ID or invitation link.
- Public matchmaking uses a separate, fixed Trystero/Nostr directory rendezvous room. Public hosts send only short-lived advertisements containing room ID, connected-player count, capacity, and free slots. The directory stores no gameplay state and has no persistent database.
- “Find match” joins an advertised public room with a free slot, or creates a fresh uniquely identified public room when none answers. A stale full-room result automatically resumes matchmaking.
- Creating, finding, or joining any room immediately updates the current URL with its fragment. Copying the current URL is the complete reusable invitation; opening it auto-joins without manual input.
- The main menu keeps two direct calls to action: “Play now” starts solo immediately and “Play online” starts the last saved public/private flow immediately. Play online shows an inline spinner and is disabled only while discovery and connection are pending.
- Settings is a non-modal dropdown aligned below the rightmost toolbar icon. It contains rider name, public/private toggle, AI count, maximum humans, music toggle, online start action, install action, and connection status. It has no redundant close button: clicking outside or pressing Escape closes it.
- Private rooms are created with one hidden high-entropy ID and one reusable fragment invitation URL; there is no editable ID, second key, or password field. Opening either a public or private invitation URL joins the intended room without a return-link exchange.
- Maximum human count is controlled by the host’s slider, currently 2–6. Excess riders receive a clear “room full” state.
- If no host is found after a short discovery window, the local peer becomes host. Simultaneous hosts resolve deterministically by peer ID. If a host leaves, remaining peers attempt a deterministic re-election; resetting the authoritative round during migration is acceptable, but the room must remain usable.
- WebRTC can still fail on restrictive networks without TURN. Communicate that limitation honestly; do not claim that “no owned server” means “no external signaling infrastructure”.
- Retain no player accounts, personal data, or central persistent lobby state.

## AI population controls

- AI count is adjustable live from 0 through 6.
- A newly created public match starts with zero AI by default; the public host may add AI live afterward. Solo and private rooms retain the device-local saved AI preference.
- Removing AI removes its cycles and walls immediately, updates the leaderboard, and leaves `state.running` true.
- Adding AI spawns it safely near the human cluster.
- In network play the host owns the AI count and sends the resulting state to guests.
- The room host owns every online room option: AI count, maximum humans, and Clear trails on crash. These controls stay disabled in the menu while host election is pending and for every guest. Once elected, only the host can change them and broadcast the result. Solo play has no room authority and exposes only its local AI-count control; maximum humans and Clear trails remain disabled there. Clear trails defaults off, persists as the host’s device preference, and is included in authoritative initialization updates.

## Audio

- Audio is synthesized with Web Audio: engine, higher-frequency whine, acceleration/grind pitch, turns, sparks/crash noise, and restrained electronic background music.
- Speed and wall proximity raise engine/whine pitch smoothly.
- Motor, high-frequency whine, turn cues, sparks, and crash noise feed a short 180 ms Web Audio delay with restrained feedback and return gain. Background music stays dry so the mix remains readable.
- The browser owns the Web Audio context lifecycle for hidden or closed tabs; the game does not create a gameplay pause around visibility changes.
- When saved audio is enabled, the first pointer or keyboard interaction resumes/creates the Web Audio context, satisfying mobile autoplay policy and restarting the score reliably after reload. The synthwave score may play in the menu after that interaction, but motor and whine gains remain at zero until a local bike is active. A saved mute remains authoritative until the user explicitly unmutes.
- Do not add unload, forced suspension, or audio-context shutdown logic solely to compensate for another still-open browser tab.
- Mute preference is device-local. Music has a separate device-local toggle and a dedicated dry mix bus without feeding the motor echo. Its original browser-synthesized score targets 1980s cyberpunk/synthwave: roughly 112 BPM, four-on-the-floor electronic kick, backbeat noise snare, pulsing minor-key bass, bright analog-style 16th-note arpeggio, and a slow four-chord pad progression. Keep it audible on phones but below the motor and collision cues.

## Visual and interaction rules

- Dominant palette: black/near-black space, cyan world grid, distinct neon rider accents, restrained magenta/amber secondary cues.
- Keep scanlines and bloom subtle. Readability at speed wins over decoration.
- Avoid visual effects above floor level that could be confused with walls or bikes.
- Menus use crisp geometric panels, thin borders, compact uppercase labels, and no rounded dashboard-card aesthetic.
- Preserve keyboard accessibility labels and visible focus styling.
- Disable text selection and the mobile touch-callout across the game UI so swipes and rapid taps never highlight labels. Text remains selectable only inside editable name and chat inputs.
- The top-right toolbar contains exactly seven compact, recognizable line icons in this order: Invite, Find match, Audio, Camera, Riders, Chat, Settings. All have accessible names and concise hover/focus tooltips; Settings is rightmost. Camera cycles the same three saved views as the C key, and Chat opens the composer, so mobile users never need a keyboard for either action. While actively riding on a small screen, Find match is hidden to preserve the same compact toolbar width; it remains available from the menu. There is no redundant brand, pause, name edit, invite action, or visible mobile steering/brake control elsewhere in the HUD.
- All user-facing interface copy is English. Technical implementation details such as “single HTML file” never appear as marketing copy in the game UI.
- Device-local preferences persist across sessions: rider name, AI count, maximum humans, camera mode, mute state, music state, leaderboard visibility, and the last public/private flow. Authoritative settings received as a guest must not overwrite these personal saved defaults.

## Networking and safety invariants

- Only the authoritative host calls the simulation step for a network room.
- Guest input messages are routed to the elected host, not broadcast as authoritative state.
- Host snapshots include names, colors, human/AI flags, position, direction, speed, meters, alive state, trail endpoints, death/respawn timing, invulnerability, scores, walls, AI count, and human limit. Initial state also carries the recent chat buffer and Clear trails on crash rule.
- A guest accepts authoritative state only from the elected host.
- Names and room codes are sanitized and length-limited before entering state or the DOM.

## Validation checklist

Before publishing any gameplay change:

1. Parse the inline script with Node (`new Function`) and run `git diff --check`.
2. Verify solo with 0 AI remains active after crashes and respawns.
3. Drive repeated left/right squares and confirm there are no corner gaps.
4. Observe multiple AI for several minutes and confirm none crosses a wall.
5. Construct two extremely close parallel trails and confirm a bike point can traverse any positive-width corridor between them without collision.
6. Observe AI near a human: straight runs should dominate, turns must not chatter, and occasional predicted-route cuts should be visible without direct ramming.
7. Confirm wall height visually matches the bike.
8. Confirm grid lines remain fixed relative to old walls while crossing several major cells.
9. Confirm electrical paths are fixed, pulses move quickly through their 90-degree turns, and the start-screen background animates.
10. Verify crash camera, silent wait, safe cluster respawn, and invulnerability ring.
11. With independent browser contexts/devices, confirm public matchmaking finds an advertised room, distinct invitation fragments stay isolated, copies of the same current URL connect peers, public/private invitation links auto-join, and private rooms never appear in public matchmaking.
12. Check desktop around 1440×900 and mobile around 390×844. On touch, verify left/right steering above the bottom band, held braking inside the bottom 17%, zero visible control overlays, the higher stats position, lower minimap, Camera/Riders/Chat toolbar toggles, Settings, chat, and leaderboard touch isolation.
13. Verify Play now starts immediately, Play online shows loading feedback then enters the grid, Settings opens only from its icon, and the toolbar is aligned top-right.
14. Open chat with T and with the toolbar icon, send with Enter, cancel with Escape or the icon, confirm gameplay keys are blocked while typing, and verify the six-message/fade limit in solo and between peers.
15. Check browser console for errors, manifest/icon/service-worker endpoints, music and audio toggles, menu/tab visibility behavior, and that echo feedback remains restrained without runaway buildup.
16. Regenerate `dist/server/index.js` with `build-worker.mjs` after every `index.html` change.

## Maintenance rule

Every accepted product decision belongs here. Add the decision to the relevant section, remove superseded behavior rather than accumulating contradictions, and update the validation checklist when a new failure mode is discovered.
