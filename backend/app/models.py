"""
Modelos de base de datos: Campañas y Personajes (PJ o monstruo).
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    ARRAY,
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from .database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="Nueva campaña")

    characters = relationship(
        "Character", back_populates="campaign", cascade="all, delete-orphan"
    )


class Character(Base):
    """
    Representa tanto a un Personaje Jugador (PJ) como a un monstruo.
    Se distinguen con el flag `is_monster`.
    """

    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)

    name = Column(String, nullable=False)
    char_class = Column(String, default="")
    sprite = Column(String, default="default")  # nombre/clave del sprite

    hp_current = Column(Integer, nullable=False, default=10)
    hp_max = Column(Integer, nullable=False, default=10)
    temp_hp = Column(Integer, nullable=False, default=0)  # HP temporales (escudo)

    is_monster = Column(Boolean, default=False)

    # Condición de estado (D&D): Healthy, Poisoned, Stunned, etc.
    condition = Column(String, default="Healthy")
    condition_rounds = Column(Integer, nullable=True)  # rondas restantes, editable

    initiative = Column(Integer, nullable=True)  # orden de iniciativa
    order_index = Column(Integer, default=0)  # posición manual en la lista

    # Historial de daño/curación reciente, ej: [{"delta": -5, "ts": ...}, ...]
    damage_history = Column(JSON, default=list)

    campaign = relationship("Campaign", back_populates="characters")
