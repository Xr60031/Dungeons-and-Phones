/**
 * Espejo de backend/app/hp_status.py — a propósito duplicado (mismo
 * criterio que tenía mobile/src/utils/hpStatus.ts en el diseño original)
 * para poder animar la barra de HP de forma optimista apenas el usuario
 * toca un botón, sin esperar el broadcast del servidor. El servidor
 * sigue siendo la fuente de verdad: cuando llega el "state" real,
 * este valor se pisa con el que mandó el backend.
 */

const STATUS_COLORS = {
  full: "#4ADE80",
  staggered: "#FB923C",
  critical: "#EF4444",
  unconscious: "#38BDF8",
  dead: "#6B7280",
};

function getHpStatus(hpCurrent, hpMax) {
  if (hpCurrent <= -1) return "dead";
  if (hpCurrent === 0) return "unconscious";
  if (hpMax <= 0) return "dead";

  const pct = (hpCurrent / hpMax) * 100;
  if (pct <= 25) return "critical";
  if (pct <= 50) return "staggered";
  return "full";
}

function withOptimisticHp(char, delta) {
  // Mismo criterio que crud.apply_hp_delta: el daño primero gasta los
  // HP temporales de a poco, y solo lo que sobra pega a la vida real.
  let remainingDelta = delta;
  let temp_hp = char.temp_hp || 0;

  if (delta < 0) {
    const damage = -delta;
    const absorbed = Math.min(temp_hp, damage);
    temp_hp -= absorbed;
    remainingDelta = -(damage - absorbed);
  }

  // Mismo clamp que crud.apply_hp_delta: entre -hp_max y hp_max.
  const raw = char.hp_current + remainingDelta;
  const hp_current = Math.max(Math.min(raw, char.hp_max), -char.hp_max);
  const status = getHpStatus(hp_current, char.hp_max);
  return {
    ...char,
    hp_current,
    temp_hp,
    status,
    status_color: STATUS_COLORS[status],
  };
}
