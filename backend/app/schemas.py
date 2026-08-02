"""
Esquemas Pydantic usados para validar requests/responses de la API
y los mensajes que viajan por WebSocket.
"""
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, ConfigDict


# ---------- Character ----------

class CharacterBase(BaseModel):
    name: str
    char_class: str = ""
    sprite: str = "default"
    hp_current: int = 10
    hp_max: int = 10
    temp_hp: int = 0
    is_monster: bool = False
    initiative: Optional[int] = None
    condition: str = "Healthy"
    condition_rounds: Optional[int] = None


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    char_class: Optional[str] = None
    sprite: Optional[str] = None
    hp_current: Optional[int] = None
    hp_max: Optional[int] = None
    temp_hp: Optional[int] = None
    is_monster: Optional[bool] = None
    initiative: Optional[int] = None
    order_index: Optional[int] = None
    condition: Optional[str] = None
    condition_rounds: Optional[int] = None


class HPDelta(BaseModel):
    delta: int  # ej: +5, -10


class TempHPAdd(BaseModel):
    amount: int  # siempre positivo, se suma a los HP temporales existentes


class Character(CharacterBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    order_index: int
    damage_history: List[Any] = []


# ---------- Campaign ----------

class CampaignBase(BaseModel):
    name: str = "Nueva campaña"


class CampaignCreate(CampaignBase):
    pass


class Campaign(CampaignBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    characters: List[Character] = []


# ---------- WebSocket messages ----------

WSAction = Literal[
    "state",  # snapshot completo del estado (server -> client)
    "character_added",
    "character_updated",
    "character_deleted",
    "hp_changed",
    "initiative_updated",
    "error",
]


class WSMessage(BaseModel):
    action: WSAction
    payload: Any = None
