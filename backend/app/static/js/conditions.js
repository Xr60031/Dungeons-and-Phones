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

function populateConditionSelect() {
  const select = document.getElementById("f-condition");
  if (!select) return;
  select.innerHTML = CONDITIONS.map(
    (name, idx) => `<option value="${idx}">${name}</option>`
  ).join("");
}

document.addEventListener("DOMContentLoaded", populateConditionSelect);
if (document.readyState !== "loading") populateConditionSelect();
