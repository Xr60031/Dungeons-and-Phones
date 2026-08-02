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
