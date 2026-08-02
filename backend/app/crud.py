"""
Operaciones de acceso a datos (CRUD) para campañas y personajes.
"""
import time
from typing import Optional
from sqlalchemy.orm import Session

from . import models, schemas


def get_or_create_default_campaign(db: Session) -> models.Campaign:
    campaign = db.query(models.Campaign).first()
    if campaign is None:
        campaign = models.Campaign(name="Campaña de prueba")
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
    return campaign


def get_campaign(db: Session, campaign_id: int) -> Optional[models.Campaign]:
    return db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()


def list_characters(db: Session, campaign_id: int):
    return (
        db.query(models.Character)
        .filter(models.Character.campaign_id == campaign_id)
        .order_by(models.Character.order_index)
        .all()
    )


def create_character(
    db: Session, campaign_id: int, data: schemas.CharacterCreate
) -> models.Character:
    max_order = (
        db.query(models.Character)
        .filter(models.Character.campaign_id == campaign_id)
        .count()
    )
    char = models.Character(
        campaign_id=campaign_id,
        order_index=max_order,
        damage_history=[],
        **data.model_dump(),
    )
    db.add(char)
    db.commit()
    db.refresh(char)
    return char


def get_character(db: Session, character_id: int) -> Optional[models.Character]:
    return (
        db.query(models.Character)
        .filter(models.Character.id == character_id)
        .first()
    )


def update_character(
    db: Session, character: models.Character, data: schemas.CharacterUpdate
) -> models.Character:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    db.commit()
    db.refresh(character)
    return character


def apply_hp_delta(
    db: Session, character: models.Character, delta: int
) -> models.Character:
    remaining_delta = delta

    if delta < 0:
        # Daño: primero se come los HP temporales (de a poco, no todos de
        # golpe). Solo lo que sobra después de gastar el escudo temporal
        # le pega a la vida real.
        damage = -delta
        temp_hp = character.temp_hp or 0
        absorbed = min(temp_hp, damage)
        character.temp_hp = temp_hp - absorbed
        remaining_delta = -(damage - absorbed)

    new_hp = character.hp_current + remaining_delta
    # Clamp entre 0 (o negativo permitido hasta -hp_max para "muerte masiva") y hp_max
    new_hp = max(min(new_hp, character.hp_max), -character.hp_max)
    character.hp_current = new_hp

    history = list(character.damage_history or [])
    history.append({"delta": delta, "ts": time.time(), "result_hp": new_hp})
    character.damage_history = history[-50:]  # limitar historial

    db.commit()
    db.refresh(character)
    return character


def add_temp_hp(
    db: Session, character: models.Character, amount: int
) -> models.Character:
    """Suma HP temporales. Lo puede pedir cualquiera (DM o jugador),
    a diferencia de editar el personaje que es solo del DM."""
    if amount > 0:
        character.temp_hp = (character.temp_hp or 0) + amount
        db.commit()
        db.refresh(character)
    return character


def delete_character(db: Session, character: models.Character) -> None:
    db.delete(character)
    db.commit()
