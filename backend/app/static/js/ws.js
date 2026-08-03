/**
 * Dungeons & Phones — cliente WebSocket
 * ------------------------------------
 * Como la app ahora la sirve el mismo backend (misma IP:puerto que la
 * página), no hace falta escanear ningún QR ni tipear una IP para
 * conectar el WebSocket: se arma directo con location.host, igual que
 * hacía antes WebSocketContext.tsx pero sin la capa de React Native.
 *
 * Mismo contrato que backend/app/main.py:
 *   → cliente envía: {action, payload}
 *     - hp_delta          {character_id, delta}
 *     - add_temp_hp       {character_id, amount}  (amount siempre > 0)
 *     - set_armor_class   {character_id, value}   (CA, solo informativa)
 *     - update_character  {character_id, data: {...}}
 *     - create_character  {name, char_class, sprite, hp_current, hp_max,
 *                           is_monster, initiative}
 *     - delete_character  {character_id}
 *   ← servidor responde (broadcast): {action:"state", payload:{characters, connected_devices}}
 *                                     {action:"error", payload:{message}}
 */

const CAMPAIGN_ID = 1; // MVP: una sola campaña, igual que el backend actual
const RECONNECT_DELAY_MS = 2000;

const DungeonsWS = (() => {
  let socket = null;
  let reconnectTimer = null;
  let manuallyClosed = false;

  const listeners = {
    state: [],
    error: [],
    statusChange: [],
  };

  function buildWsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws/${CAMPAIGN_ID}`;
  }

  function emitStatus(status) {
    listeners.statusChange.forEach((cb) => cb(status));
  }

  function connect() {
    manuallyClosed = false;
    clearTimeout(reconnectTimer);
    emitStatus("connecting");

    socket = new WebSocket(buildWsUrl());

    socket.addEventListener("open", () => {
      emitStatus("online");
    });

    socket.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.action === "state") {
        listeners.state.forEach((cb) => cb(msg.payload));
      } else if (msg.action === "error") {
        listeners.error.forEach((cb) => cb(msg.payload));
      }
    });

    socket.addEventListener("close", () => {
      emitStatus("offline");
      if (!manuallyClosed) {
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  function send(action, payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action, payload }));
      return true;
    }
    return false;
  }

  function on(event, cb) {
    if (listeners[event]) listeners[event].push(cb);
  }

  return {
    connect,
    send,
    on,
    hpDelta: (characterId, delta) =>
      send("hp_delta", { character_id: characterId, delta }),
    addTempHp: (characterId, amount) =>
      send("add_temp_hp", { character_id: characterId, amount }),
    setArmorClass: (characterId, value) =>
      send("set_armor_class", { character_id: characterId, value }),
    updateCharacter: (characterId, data) =>
      send("update_character", { character_id: characterId, data }),
    createCharacter: (data) => send("create_character", data),
    deleteCharacter: (characterId) =>
      send("delete_character", { character_id: characterId }),
  };
})();
