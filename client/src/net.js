// The realtime server: socket.io at /ws, WebSocket only (no long-polling warm-up, one idle connection).
// Messages are the 2013 protocol: create/read/update with {model, options}, server 'update' broadcasts, and
// 'time' for the clock skew.
import { io } from 'socket.io-client';

let socket = null;
export let skew = 0; // local minus server, ms

export function connect({ onUpdate, onReconnect, onStatus }) {
  if (socket) { return socket; }
  socket = io(window.GC_SERVER || undefined, {
    path: '/ws', addTrailingSlash: false, transports: ['websocket'],
  });
  let connectedOnce = false;
  socket.on('connect', () => {
    const sent = Date.now();
    socket.emit('time', (err, serverNow) => {
      if (!err && typeof serverNow === 'number') { skew = Math.round((sent + Date.now()) / 2 - serverNow); }
    });
    onStatus && onStatus('online');
    // The server forgets rooms on a reconnect: read the game again to rejoin it.
    if (connectedOnce && onReconnect) { onReconnect(); }
    connectedOnce = true;
  });
  socket.on('disconnect', () => onStatus && onStatus('offline'));
  socket.on('update', (game) => onUpdate && onUpdate(game));
  return socket;
}

export function disconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function send(method, model) {
  return new Promise((resolve, reject) => {
    if (!socket) { reject(new Error('Not connected.')); return; }
    const timer = setTimeout(() => reject(new Error('The server did not answer.')), 8000);
    socket.emit(method, { model, options: {} }, (err, game) => {
      clearTimeout(timer);
      if (err || !game) { reject(new Error((err && err.error) || 'Game not found.')); } else { resolve(game); }
    });
  });
}
