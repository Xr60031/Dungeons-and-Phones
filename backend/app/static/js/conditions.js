/**
 * Condiciones de estado (D&D). El índice de este array es el valor que
 * mueve el slider del modal — por eso el orden importa: "Healthy" va
 * siempre en el índice 0 (significa "sin condición").
 */
const CONDITIONS = [
  "Healthy",
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
  "Exhaustion",
];

function conditionIndex(name) {
  const idx = CONDITIONS.indexOf(name);
  return idx === -1 ? 0 : idx;
}

// Llena el <select> de condiciones con una <option> por cada entrada
// de CONDITIONS, en el mismo orden (el value sigue siendo el índice,
// para no tocar el resto del código que ya trabaja con índices).
function populateConditionSelect() {
  const select = document.getElementById("f-condition");
  if (!select) return;
  select.innerHTML = CONDITIONS.map(
    (name, idx) => `<option value="${idx}">${name}</option>`
  ).join("");
}

document.addEventListener("DOMContentLoaded", populateConditionSelect);
// Si el script corre después de DOMContentLoaded (script al final del
// body, que es el caso acá), el evento ya disparó: poblamos también
// de una vez, sin esperar nada.
if (document.readyState !== "loading") populateConditionSelect();
