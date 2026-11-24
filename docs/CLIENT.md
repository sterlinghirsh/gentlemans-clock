# The client (2026 rebuild)

The 2013 Backbone/jQuery/Bootstrap 2/RequireJS client was replaced in November 2026 by plain HTML, CSS and ES
modules (`client/`), bundled by esbuild into one 59 KB `app.js` (socket.io-client included) and a 17 KB stylesheet.
The server and the wire protocol did not change.

## What it is for

A phone lying on a table between players. The screen is built for reading across the table and for tapping
without looking: the current player's name and clock fill the top of the screen in their colour, the whole clock
panel is the "turn done" button, and Back / Pause / Next sit at the bottom for one thumb. The player list is below
the clock; tap a player to rename, recolour, reorder, adjust time or remove them. Everything else (sharing, adding
players, this phone's settings, reset, leave) is in the menu sheet.

## Features kept

Any number of players (the server caps a game at 12), time per turn and per game, counting up or down, public
games by a five-letter code (`#game/<code>` links from 2013 still work), private games saved on the phone. Saved
private games use the 2013 `localStorage.localGame` format unchanged; `model.normalizeGame` checks and cleans one
when it loads.

## Motion

Transitions on `transform` and `opacity` only, ease-out, 160-420 ms: the turn handoff (the old player's panel fades
and drops away as the next slides up in its colour), sheets, toggles, presses. `prefers-reduced-motion` cuts them to
1 ms. Nothing animates while the clock sits idle, and there are no infinite animations.

## Battery

- OLED black ground; the clock panel is a 14% wash of the player's colour.
- The clock redraws only when a visible digit changes: `model.msToNextChange` returns the time to the next
  boundary and the page sleeps that long in one `setTimeout`. Whole seconds normally; tenths only on a game-time
  countdown under 10 s. No `requestAnimationFrame`, no `setInterval`, nothing scheduled while paused or hidden.
- socket.io runs WebSocket-only (no long-polling start).
- The Web Audio context for the turn chime is suspended again 0.6 s after each chime.
- Screen Wake Lock is held while a game runs (menu: Keep screen on, default on), released when paused, and asked
  for again when the page comes back into view (the browser drops it whenever the page hides).

## The turn cue

A web page can't switch on a phone screen that's off. The wake lock keeps the screen on through the game, and the
cue makes the change unmistakable when it's on:
- every turn change slides the clock panel to the new player's colour;
- a phone set to "This phone plays as <player>" flashes full screen in that player's colour with YOUR TURN, keeps a
  stronger wash while it's their turn, chimes and vibrates (each toggled in the menu, default on);
- a shared phone (nobody picked) chimes and vibrates when another phone passes the turn to it, not on its own taps.
Vibration works on Android Chrome; iOS Safari has no Vibration API. Browsers allow sound only after the first tap
on the page, which every player makes anyway.

## Home screen

`manifest.json` (standalone, black, any orientation) with SVG, 192/512 PNG and maskable icons, plus an Apple touch
icon. There is deliberately no service worker: with none, a new deploy reaches every player on their next load
(`?v=<build>` busts the cache of the JS and CSS), and nobody gets stuck on an old build.

## Web Push (not built)

What turning on a screen that's off would take: Web Push.
- A service worker (push-only: no `fetch` handler, so it caches nothing and can't pin an old build) and
  `PushManager.subscribe` with the server's VAPID public key, after a permission prompt from a tap.
- On the server: VAPID keys (the private key is a secret in the unit's environment, never in the repo), a
  subscription per game seat, and on a turn change an encrypted push to the next player's subscription (the
  `web-push` package, or about 150 lines of ECDH + aes128gcm). Subscriptions live and die with the game.
- iOS delivers web push only to a web app added to the home screen (iOS 16.4+), and only after the user allows it
  there; Android Chrome works from the browser.
- Delivery goes through Google's or Apple's push service: usually well under a few seconds with `Urgency: high`,
  with no guarantee, versus ~3 ms for the open socket. A notification lights the screen on most phones.
Roughly a day's work plus a device test on both platforms. Worth it only if players really leave screens off.
