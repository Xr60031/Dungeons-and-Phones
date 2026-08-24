"""
    Full          51-100%   Verde
    Staggered     26-50%    Naranja
    Critical      1-25%     Rojo
    Unconscious   0         Celeste
    Dead          <=-1      Gris oscuro
"""
from typing import Literal

HPStatus = Literal["full", "staggered", "critical", "unconscious", "dead"]

STATUS_COLORS = {
    "healthy": "#4ADE80",
    "staggered": "#FB923C",
    "critical": "#EF4444",
    "unconscious": "#38BDF8",
    "dead": "#6B7280",
}


def get_hp_status(hp_current: int, hp_max: int) -> HPStatus:
    if hp_current <= -1:
        return "dead"

    if hp_current == 0:
        return "unconscious"

    if hp_max <= 0:
        return "dead"

    pct = (hp_current / hp_max) * 100

    if pct <= 25:
        return "critical"
    if pct <= 50:
        return "staggered"
    return "healthy"
