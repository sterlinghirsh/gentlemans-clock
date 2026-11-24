gentlemans-clock
================

A multiplayer game clock api and client.

See the live version at http://gmclk.com or http://gentlemans-clock.com.

## Layout (2026)

- `server/`: the realtime server (`main.js`: socket.io on `/ws`, `GET /health`; `store.js`: games in memory with a
  JSON snapshot in `DATA_DIR`, idle games expire after a day; `validate.js`: every socket message is checked).
- `client/index.html` + `static/`: the 2013 Backbone client. `npm run build` writes the static page to `dist/`
  (`REALTIME_ORIGIN` is the socket server; empty means the page's own origin).
- `deploy/`: kitten's deploy driver config. The page goes to sterlinghirsh.com/gentlemans-clock/ (cPanel), the server
  to gentlemans-clock.rt.sterlinghirsh.com (realtime-1, port 7101).

Run it locally: `npm install`, `npm run dev`, open http://127.0.0.1:3000/. Test: `npm test`.

Deploy (from a clean tree):

    GAME_DEPLOY=~/Documents/Sterling-Documents-Sync/hornet-web/kitten/deploy/game-deploy.sh deploy/deploy.sh plan
    … deploy/deploy.sh --dry-run | stage | setup | (no argument: deploy)
