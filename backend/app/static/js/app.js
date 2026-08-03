/**
 * Dungeons & Phones — app shell
 * El rol (DM / jugador) es solo una preferencia de UI guardada en este
 * celular (localStorage); el backend no tiene auth todavía — cualquier
 * dispositivo conectado puede tocar cualquier personaje, igual que en
 * el diseño original. Lo que cambia según el rol es qué botones se ven.
 */

const ROLE_KEY = "dnp_role";

let state = {
  characters: [],
  connectedDevices: 0,
  role: localStorage.getItem(ROLE_KEY) || null,
  editingCharacterId: null,
};

const el = {
  screenRole: document.getElementById("screen-role"),
  screenBoard: document.getElementById("screen-board"),
  charList: document.getElementById("char-list"),
  connDot: document.getElementById("conn-dot"),
  connLabel: document.getElementById("conn-label"),
  fabAdd: document.getElementById("fab-add"),
  modalOverlay: document.getElementById("modal-overlay"),
  charForm: document.getElementById("char-form"),
  modalTitle: document.getElementById("modal-title"),
  modalCancel: document.getElementById("modal-cancel"),
  toast: document.getElementById("toast"),
  roleHint: document.getElementById("role-hint"),
  btnChangeRole: document.getElementById("btn-change-role"),
  fCondition: document.getElementById("f-condition"),
  fConditionLabel: document.getElementById("f-condition-label"),
  fConditionRounds: document.getElementById("f-condition-rounds"),
};

// ---------- pantallas ----------

function showScreen() {
  if (!state.role) {
    el.screenRole.classList.remove("hidden");
    el.screenBoard.classList.add("hidden");
    el.fabAdd.classList.add("hidden");
    el.btnChangeRole.classList.add("hidden");
  } else {
    el.screenRole.classList.add("hidden");
    el.screenBoard.classList.remove("hidden");
    el.fabAdd.classList.toggle("hidden", state.role !== "dm");
    el.btnChangeRole.classList.remove("hidden");
    renderBoard();
  }
}

document.querySelectorAll("[data-role]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.role = btn.dataset.role;
    localStorage.setItem(ROLE_KEY, state.role);
    showScreen();
  });
});

el.btnChangeRole.addEventListener("click", () => {
  if (!confirm("¿Volver al menú principal? Vas a tener que elegir Jugador o DM de nuevo.")) return;
  state.role = null;
  localStorage.removeItem(ROLE_KEY);
  showScreen();
});

// ---------- render ----------

function renderBoard() {
  renderCharList(el.charList, state.characters, {
    isDM: state.role === "dm",
    onDelta: handleDelta,
    onEdit: openEditModal,
    onDelete: handleDelete,
    onAddTempHp: handleAddTempHp,
    onSetArmorClass: handleSetArmorClass,
  });
}

function handleDelta(char, delta) {
  // Optimista: refleja el cambio ya mismo, el broadcast del server confirma/corrige.
  const idx = state.characters.findIndex((c) => c.id === char.id);
  if (idx !== -1) {
    state.characters[idx] = withOptimisticHp(char, delta);
    renderBoard();
  }
  DungeonsWS.hpDelta(char.id, delta);
}

function handleAddTempHp(char) {
  // Cualquiera (jugador o DM) puede sumarle HP temporales a un personaje
  // visible, sin pasar por el modal de edición (que es solo del DM).
  const input = prompt(`¿Cuántos HP temporales le sumás a ${char.name}?`, "5");
  if (input === null) return; // canceló

  const amount = parseInt(input, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Ingresá un número mayor a 0");
    return;
  }

  // Optimista: se ve el escudo ya mismo, el broadcast del server confirma.
  const idx = state.characters.findIndex((c) => c.id === char.id);
  if (idx !== -1) {
    state.characters[idx] = { ...char, temp_hp: (char.temp_hp || 0) + amount };
    renderBoard();
  }
  DungeonsWS.addTempHp(char.id, amount);
}

function handleSetArmorClass(char) {
  // Cualquiera (jugador o DM) puede fijar la CA de un personaje visible,
  // sin pasar por el modal de edición (que es solo del DM). Es un dato
  // puramente informativo: no afecta ningún cálculo del backend.
  const input = prompt(`CA (Clase de Armadura) de ${char.name}:`, char.armor_class ?? 10);
  if (input === null) return; // canceló

  const value = parseInt(input, 10);
  if (!Number.isFinite(value) || value < 0) {
    showToast("Ingresá un número válido (0 o más)");
    return;
  }

  // Optimista: se ve el cambio ya mismo, el broadcast del server confirma.
  const idx = state.characters.findIndex((c) => c.id === char.id);
  if (idx !== -1) {
    state.characters[idx] = { ...char, armor_class: value };
    renderBoard();
  }
  DungeonsWS.setArmorClass(char.id, value);
}

function handleDelete(char) {
  if (!confirm(`¿Eliminar a ${char.name}?`)) return;
  DungeonsWS.deleteCharacter(char.id);
}

// ---------- modal alta/edición ----------

function openCreateModal() {
  state.editingCharacterId = null;
  el.modalTitle.textContent = "Nuevo personaje";
  el.charForm.reset();
  document.getElementById("f-hp-current").value = 10;
  document.getElementById("f-hp-max").value = 10;
  document.getElementById("f-hp-temp").value = 0;
  document.getElementById("f-armor-class").value = 10;
  el.fCondition.value = 0;
  el.fConditionLabel.textContent = CONDITIONS[0];
  el.fConditionRounds.value = "";
  el.modalOverlay.classList.remove("hidden");
}

function openEditModal(char) {
  state.editingCharacterId = char.id;
  el.modalTitle.textContent = "Editar personaje";
  document.getElementById("f-name").value = char.name;
  document.getElementById("f-class").value = char.char_class || "";
  document.getElementById("f-initiative").value = char.initiative ?? "";
  document.getElementById("f-hp-current").value = char.hp_current;
  document.getElementById("f-hp-max").value = char.hp_max;
  document.getElementById("f-hp-temp").value = char.temp_hp ?? 0;
  document.getElementById("f-armor-class").value = char.armor_class ?? 10;
  document.getElementById("f-is-monster").checked = !!char.is_monster;
  const idx = conditionIndex(char.condition || "Healthy");
  el.fCondition.value = idx;
  el.fConditionLabel.textContent = CONDITIONS[idx];
  el.fConditionRounds.value = char.condition_rounds ?? "";
  el.modalOverlay.classList.remove("hidden");
}

function closeModal() {
  el.modalOverlay.classList.add("hidden");
}

el.fabAdd.addEventListener("click", openCreateModal);
el.modalCancel.addEventListener("click", closeModal);
el.modalOverlay.addEventListener("click", (e) => {
  if (e.target === el.modalOverlay) closeModal();
});

el.fCondition.addEventListener("input", () => {
  el.fConditionLabel.textContent = CONDITIONS[parseInt(el.fCondition.value, 10)];
});

el.charForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const initiativeRaw = document.getElementById("f-initiative").value;
  const roundsRaw = el.fConditionRounds.value;
  const payload = {
    name: document.getElementById("f-name").value.trim(),
    char_class: document.getElementById("f-class").value.trim(),
    hp_current: parseInt(document.getElementById("f-hp-current").value, 10),
    hp_max: parseInt(document.getElementById("f-hp-max").value, 10),
    temp_hp: parseInt(document.getElementById("f-hp-temp").value, 10) || 0,
    armor_class: parseInt(document.getElementById("f-armor-class").value, 10) || 0,
    is_monster: document.getElementById("f-is-monster").checked,
    initiative: initiativeRaw === "" ? null : parseInt(initiativeRaw, 10),
    condition: CONDITIONS[parseInt(el.fCondition.value, 10)],
    condition_rounds: roundsRaw === "" ? null : parseInt(roundsRaw, 10),
  };

  if (!payload.name) return;

  if (state.editingCharacterId) {
    DungeonsWS.updateCharacter(state.editingCharacterId, payload);
  } else {
    DungeonsWS.createCharacter({ sprite: "default", ...payload });
  }
  closeModal();
});

// ---------- toast ----------

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 3500);
}

// ---------- WebSocket wiring ----------

DungeonsWS.on("statusChange", (status) => {
  el.connDot.classList.toggle("online", status === "online");
  el.connLabel.textContent =
    status === "online" ? "conectado" : status === "connecting" ? "conectando…" : "sin conexión, reintentando…";
});

DungeonsWS.on("state", (payload) => {
  state.characters = payload.characters;
  state.connectedDevices = payload.connected_devices;
  if (state.role) renderBoard();
});

DungeonsWS.on("error", (payload) => {
  showToast(payload.message || "Ocurrió un error");
});

// ---------- service worker (para que quede instalable y funcione offline) ----------

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* si falla el SW, la app sigue funcionando online igual */
    });
  });
}

// ---------- arranque ----------

showScreen();
DungeonsWS.connect();
