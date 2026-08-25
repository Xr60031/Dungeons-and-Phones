const CAMPAIGN_ID = 1;
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
