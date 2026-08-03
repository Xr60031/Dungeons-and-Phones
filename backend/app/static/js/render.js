/**
 * Render de personajes. Todo lo visual (color/estado de HP) sale de lo
 * que ya manda el backend (status + status_color en hp_status.py) —
 * el front no reinventa el umbral, solo lo dibuja.
 *
 * IMPORTANTE: las cards se crean UNA sola vez por personaje y después
 * se actualizan in-place (no se destruyen/recrean en cada mensaje
 * `state`). Esto es lo que permite que el `transition: width` de
 * style.css anime solo, sin tener que recordar "desde dónde" venía la
 * barra: el navegador ya sabe el ancho real actual del elemento que
 * sigue vivo en el DOM. También evita que las partículas se reinicien
 * en cada eco de red — solo se regeneran cuando el HP (o el color de
 * la barra) realmente cambió.
 */

const STATUS_LABELS = {
  full: "Full",
  staggered: "Staggered",
  critical: "Critical",
  unconscious: "Unconscious",
  dead: "Dead",
};

// Cantidad de partículas que salpica la barra. Sin vida (pct 0, es decir
// unconscious o dead) no hay partículas: no queda energía para sprinklear.
const PARTICLE_COUNT = 4;

// Cache de cards vivas por id de personaje, para poder actualizarlas
// in-place en vez de recrearlas en cada render.
let cardsById = {};

function buildParticlesEl(pct, color) {
  const wrap = document.createElement("div");
  wrap.className = "hp-particles";
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const left = (Math.random() * Math.max(pct, 6)).toFixed(1);
    const delay = (Math.random() * 1.8).toFixed(2);
    const duration = (1.1 + Math.random() * 0.9).toFixed(2);
    const drift = (Math.random() * 12 - 6).toFixed(1);
    const span = document.createElement("span");
    span.className = "hp-particle";
    span.style.cssText = `left:${left}%; --particle-color:${color}; --drift:${drift}px; animation-delay:${delay}s; animation-duration:${duration}s;`;
    wrap.appendChild(span);
  }
  return wrap;
}

function sortCharacters(characters) {
  return [...characters].sort((a, b) => {
    const ai = a.initiative ?? -Infinity;
    const bi = b.initiative ?? -Infinity;
    if (ai !== bi) return bi - ai; // mayor iniciativa primero
    return a.order_index - b.order_index;
  });
}

function renderCharList(container, characters, { isDM, onDelta, onEdit, onDelete, onAddTempHp }) {
  const sorted = sortCharacters(characters);
  const ctx = { isDM, onDelta, onEdit, onDelete, onAddTempHp };

  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state">${
      isDM
        ? "Todavía no hay personajes. Tocá «+ personaje» para agregar el primero."
        : "Esperando a que el DM cargue los personajes…"
    }</div>`;
    cardsById = {};
    return;
  }

  // Si lo último pintado fue el empty-state (o el container está
  // recién estrenado), arrancamos de cero.
  if (container.querySelector(".empty-state")) {
    container.innerHTML = "";
  }

  const seenIds = new Set();

  sorted.forEach((char, idx) => {
    const key = String(char.id);
    seenIds.add(key);

    let entry = cardsById[key];

    // Si no existe todavía, o si cambió algo que afecta la ESTRUCTURA
    // de la card (rol o si el personaje pasó a ser "enemigo oculto"),
    // la reconstruimos de cero. Esto es raro (no pasa en el uso normal,
    // el rol es fijo por sesión), así que perder la animación acá no
    // afecta el caso común.
    const isHiddenEnemyInfo = char.is_monster && !isDM;
    if (!entry || entry.isDM !== isDM || entry.isHiddenEnemyInfo !== isHiddenEnemyInfo) {
      if (entry) entry.el.remove();
      entry = buildCharCard(char, isDM, isHiddenEnemyInfo, ctx);
      cardsById[key] = entry;
    }

    updateCharCard(entry, char, idx, ctx);

    // Asegurar la posición correcta sin recrear el nodo: insertBefore
    // sobre un nodo ya presente en el DOM simplemente lo mueve.
    const expectedNode = container.children[idx];
    if (expectedNode !== entry.el) {
      container.insertBefore(entry.el, expectedNode || null);
    }
  });

  // Sacar del DOM (y del cache) las cards de personajes que ya no están.
  Object.keys(cardsById).forEach((key) => {
    if (!seenIds.has(key)) {
      cardsById[key].el.remove();
      delete cardsById[key];
    }
  });
}

// Crea el esqueleto de la card UNA sola vez. El contenido dinámico se
// llena después vía updateCharCard.
function buildCharCard(char, isDM, isHiddenEnemyInfo, ctx) {
  const card = document.createElement("div");
  card.className = "char-card pixel-panel";

  card.innerHTML = `
    <div class="char-card-top">
      <div class="char-id"></div>
      <div class="char-name-wrap">
        <div class="char-name"></div>
        ${isHiddenEnemyInfo ? "" : `<div class="char-class"></div>`}
      </div>
      <div class="initiative-badge hidden"></div>
      <div class="ac-badge" data-action="set-ac" title="Tocar para editar la CA">🛡<span class="ac-value"></span></div>
      ${
        isDM
          ? `<div class="char-actions">
               <button class="icon-btn" data-action="edit" title="Editar">✎</button>
               <button class="icon-btn" data-action="delete" title="Eliminar">✕</button>
             </div>`
          : ""
      }
    </div>

    <div class="hp-row">
      <div class="hp-bar-wrap">
        <div class="hp-bar-track">
          <div class="hp-bar-fill"></div>
        </div>
      </div>
      ${isHiddenEnemyInfo ? "" : `<div class="hp-numbers"></div>`}
    </div>
    <div class="hp-status-label"></div>

    ${
      isHiddenEnemyInfo
        ? ""
        : `<div class="hp-delta-row">
             <input
               type="number"
               inputmode="numeric"
               class="hp-delta-input"
               placeholder="0"
               min="0"
             />
             <button class="hp-sign-btn negative" data-sign="-1" title="Restar">−</button>
             <button class="hp-sign-btn positive" data-sign="1" title="Sumar">+</button>
           </div>
           <div class="hp-combo-preview hidden">
             <div class="combo-taps"></div>
             <div class="combo-result"></div>
             <div class="combo-actions">
               <button class="combo-btn combo-cancel" data-action="combo-cancel">✕ Cancelar</button>
               <button class="combo-btn combo-confirm" data-action="combo-confirm">✓ Confirmar</button>
             </div>
           </div>
           <div class="hp-temphp-row">
             <button class="temphp-btn" data-action="add-temp-hp">🛡 + HP temporales</button>
           </div>`
    }
  `;

  const entry = {
    el: card,
    isDM,
    isHiddenEnemyInfo,
    char, // último char aplicado; los listeners lo leen en el momento del click
    ctx,
    lastPct: null,
    lastBarColor: null,
    // Toques acumulados de +/- que todavía no se confirmaron. Se aplican
    // como un único delta al tocar "Confirmar" (o se descartan con
    // "Cancelar"). Así se puede combinar +10+10+5+1 antes de mandar nada.
    pendingTaps: [],
    els: {
      charId: card.querySelector(".char-id"),
      charName: card.querySelector(".char-name"),
      charClass: card.querySelector(".char-class"),
      initiativeBadge: card.querySelector(".initiative-badge"),
      acValue: card.querySelector(".ac-value"),
      hpDeltaInput: card.querySelector(".hp-delta-input"),
      hpBarTrack: card.querySelector(".hp-bar-track"),
      hpBarFill: card.querySelector(".hp-bar-fill"),
      hpBarWrap: card.querySelector(".hp-bar-wrap"),
      hpNumbers: card.querySelector(".hp-numbers"),
      hpStatusLabel: card.querySelector(".hp-status-label"),
      comboPreview: card.querySelector(".hp-combo-preview"),
      comboTaps: card.querySelector(".combo-taps"),
      comboResult: card.querySelector(".combo-result"),
    },
  };

  card.querySelector('[data-action="set-ac"]').addEventListener("click", () => entry.ctx.onSetArmorClass(entry.char));

  if (!isHiddenEnemyInfo) {
    const deltaInput = entry.els.hpDeltaInput;

    // Suma (o resta) el valor cargado en el input como un tap más al
    // combo pendiente, según el signo del botón tocado. El input se
    // limpia después de cada tap para que el próximo número se cargue
    // desde cero.
    const addSignedTap = (sign) => {
      const amount = parseInt(deltaInput.value, 10);
      if (!Number.isFinite(amount) || amount <= 0) return;
      entry.pendingTaps.push(sign * amount);
      deltaInput.value = "";
      updateComboPreview(entry);
      deltaInput.focus();
    };

    card.querySelectorAll("[data-sign]").forEach((btn) => {
      btn.addEventListener("click", () => addSignedTap(parseInt(btn.dataset.sign, 10)));
    });

    // Enter en el teclado numérico suma por defecto (el caso más común),
    // sin obligar a tocar el botón "+" a mano.
    deltaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addSignedTap(1);
      }
    });

    card.querySelector('[data-action="add-temp-hp"]').addEventListener("click", () => entry.ctx.onAddTempHp(entry.char));
    card.querySelector('[data-action="combo-cancel"]').addEventListener("click", () => {
      entry.pendingTaps = [];
      deltaInput.value = "";
      updateComboPreview(entry);
    });
    card.querySelector('[data-action="combo-confirm"]').addEventListener("click", () => {
      const total = entry.pendingTaps.reduce((a, b) => a + b, 0);
      entry.pendingTaps = [];
      deltaInput.value = "";
      updateComboPreview(entry);
      if (total !== 0) entry.ctx.onDelta(entry.char, total);
    });
  }

  if (isDM) {
    card.querySelector('[data-action="edit"]').addEventListener("click", () => entry.ctx.onEdit(entry.char));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => entry.ctx.onDelete(entry.char));
  }

  return entry;
}

// Pinta (o esconde) la vista previa de la combinación de toques
// pendientes: "+10 +10 +5 +1", el total, y a qué HP resultaría
// aplicarlo (usando la misma lógica de temp_hp/clamp que el backend,
// vía withOptimisticHp, para que la preview sea fiel).
function updateComboPreview(entry) {
  const { els, char, pendingTaps } = entry;
  if (!els.comboPreview) return;

  if (pendingTaps.length === 0) {
    els.comboPreview.classList.add("hidden");
    els.comboTaps.textContent = "";
    els.comboResult.textContent = "";
    return;
  }

  const total = pendingTaps.reduce((a, b) => a + b, 0);
  const preview = withOptimisticHp(char, total);

  els.comboPreview.classList.remove("hidden");
  els.comboTaps.textContent = pendingTaps.map((d) => (d > 0 ? "+" + d : d)).join(" ");
  els.comboResult.innerHTML = `${char.hp_current} → <strong style="color:${preview.status_color}">${
    preview.hp_current
  }</strong> (${total > 0 ? "+" : ""}${total})`;
}

// Actualiza una card existente con los datos nuevos del personaje, sin
// tocar el DOM más de lo necesario.
function updateCharCard(entry, char, displayIndex, ctx) {
  const { el, els, isHiddenEnemyInfo } = entry;

  entry.char = char;
  entry.ctx = ctx;

  el.classList.toggle("is-dead", char.status === "dead");
  el.classList.toggle("is-unconscious", char.status === "unconscious");

  els.charId.textContent = displayIndex + 1;
  els.charName.textContent = char.name;
  els.charName.classList.toggle("is-monster", !!char.is_monster);

  if (els.charClass) {
    els.charClass.textContent = char.char_class || (char.is_monster ? "Monstruo" : "");
  }

  if (char.initiative !== null && char.initiative !== undefined) {
    els.initiativeBadge.textContent = `ini ${char.initiative}`;
    els.initiativeBadge.classList.remove("hidden");
  } else {
    els.initiativeBadge.classList.add("hidden");
  }

  els.acValue.textContent = char.armor_class ?? 10;

  // ---- barra de HP ----
  const pct = char.hp_max > 0 ? Math.max(0, Math.min(100, (char.hp_current / char.hp_max) * 100)) : 0;

  const tempHp = char.temp_hp || 0;
  const tempPct =
    tempHp > 0 && char.hp_max > 0 ? Math.max(0, Math.min(100 - pct, (tempHp / char.hp_max) * 100)) : 0;

  const hasCondition = !!char.condition && char.condition !== "Healthy";
  const barColor = hasCondition ? "#A855F7" : char.status_color;

  // Como la card sigue viva en el DOM, alcanza con fijar el ancho
  // nuevo: el navegador anima desde el ancho real actual gracias al
  // `transition: width` de style.css. No hace falta guardar "desde
  // dónde" ni el truco del doble rAF.
  els.hpBarFill.style.width = pct + "%";
  els.hpBarFill.style.setProperty("--seg-color", barColor);

  // hp-bar-temp: se crea/destruye solo cuando aparece/desaparece del
  // todo (no en cada render), y si ya existe se actualiza in-place.
  let tempEl = els.hpBarTrack.querySelector(".hp-bar-temp");
  if (tempPct > 0) {
    if (!tempEl) {
      tempEl = document.createElement("div");
      tempEl.className = "hp-bar-temp";
      els.hpBarTrack.appendChild(tempEl);
    }
    tempEl.style.width = tempPct + "%";
  } else if (tempEl) {
    tempEl.remove();
  }

  // hp-cracks: presente mientras haya alguna condición activa.
  let cracksEl = els.hpBarTrack.querySelector(".hp-cracks");
  if (hasCondition) {
    if (!cracksEl) {
      cracksEl = document.createElement("div");
      cracksEl.className = "hp-cracks";
      els.hpBarTrack.appendChild(cracksEl);
    }
  } else if (cracksEl) {
    cracksEl.remove();
  }

  // Partículas: solo se regeneran cuando el % de vida o el color de la
  // barra realmente cambiaron respecto del último render aplicado. Así
  // no mueren y renacen en cada eco de red que no les afecta (p. ej. el
  // DM viendo cambios de HP de otros personajes).
  const particleKey = `${pct.toFixed(2)}|${barColor}`;
  if (entry.lastParticleKey !== particleKey) {
    entry.lastParticleKey = particleKey;
    const existingParticles = els.hpBarWrap.querySelector(".hp-particles");
    if (existingParticles) existingParticles.remove();
    if (pct > 0) {
      els.hpBarWrap.appendChild(buildParticlesEl(pct, barColor));
    }
  }

  // ---- resto de la info ----
  if (els.hpNumbers) {
    els.hpNumbers.innerHTML = `${char.hp_current}/${char.hp_max}${
      tempHp > 0 ? ` <span class="hp-temp-badge">+${tempHp}</span>` : ""
    }`;
  }

  els.hpStatusLabel.textContent = STATUS_LABELS[char.status] || char.status;
  els.hpStatusLabel.style.color = char.status_color;

  // condition-badge: se inserta después del status label, antes de los
  // botones (o al final si no hay botones).
  let condEl = el.querySelector(".condition-badge");
  if (hasCondition && !isHiddenEnemyInfo) {
    if (!condEl) {
      condEl = document.createElement("div");
      condEl.className = "condition-badge";
      els.hpStatusLabel.insertAdjacentElement("afterend", condEl);
    }
    condEl.innerHTML = `${escapeHtml(char.condition)}${
      char.condition_rounds !== null && char.condition_rounds !== undefined
        ? ` · ${char.condition_rounds} ${char.condition_rounds === 1 ? "ronda" : "rondas"}`
        : ""
    }`;
  } else if (condEl) {
    condEl.remove();
  }

  if (!isHiddenEnemyInfo) {
    updateComboPreview(entry);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
