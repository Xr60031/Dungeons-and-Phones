"""
Dungeons & Phones — Backend
============================
FastAPI + WebSockets + SQLite corriendo en la PC del DM.
Los teléfonos (jugadores y DM) se conectan por la red WiFi local.

Endpoints REST: CRUD de campañas y personajes (útil para carga inicial
y para clientes que prefieran polling).
Endpoint WebSocket (/ws/{campaign_id}): canal en tiempo real para
sincronizar HP, iniciativa, altas y bajas entre todos los dispositivos.
"""
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas, crud
from .database import engine, get_db, run_migrations
from .websocket_manager import manager
from .qr_utils import build_connection_url, build_fallback_ip_url, generate_qr_png_bytes
from .hp_status import get_hp_status, STATUS_COLORS

models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="Dungeons & Phones API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def character_to_dict(char: models.Character) -> dict:
    status = get_hp_status(char.hp_current, char.hp_max)
    return {
        "id": char.id,
        "campaign_id": char.campaign_id,
        "name": char.name,
        "char_class": char.char_class,
        "sprite": char.sprite,
        "hp_current": char.hp_current,
        "hp_max": char.hp_max,
        "temp_hp": char.temp_hp or 0,
        "armor_class": char.armor_class if char.armor_class is not None else 10,
        "char_type": char.char_type or "player",
        "initiative": char.initiative,
        "order_index": char.order_index,
        "condition": char.condition or "Healthy",
        "condition_rounds": char.condition_rounds,
        "condition_note": char.condition_note,
        "status": status,
        "status_color": STATUS_COLORS[status],
    }


async def broadcast_state(db: Session, campaign_id: int):
    characters = crud.list_characters(db, campaign_id)
    await manager.broadcast(
        campaign_id,
        {
            "action": "state",
            "payload": {
                "characters": [character_to_dict(c) for c in characters],
                "connected_devices": manager.connection_count(campaign_id),
            },
        },
    )


# ---------------------------------------------------------------------
# Conexión / QR (Fase 3)
# ---------------------------------------------------------------------

@app.get("/connection-info")
def connection_info(port: int = 8000):
    """Devuelve la URL de la página que debe abrir el celular (la PWA).

    Antes esto apuntaba a un ws://, pensado para que Expo Go abriera el
    socket directo. Ahora el celular primero abre la página en el
    navegador (que sirve este mismo backend) y es esa página la que,
    ya cargada, abre su propio WebSocket contra location.host — por
    eso acá alcanza con la URL http normal.

    `url` es el link genérico por mDNS (no cambia aunque cambie la IP
    de la PC); `fallback_url` es la IP directa, por si algún celular no
    resuelve mDNS en esa red.
    """
    return {"url": build_connection_url(port), "fallback_url": build_fallback_ip_url(port)}


@app.get("/connection-qr.png")
def connection_qr(port: int = 8000):
    """PNG con el QR de conexión: apunta a la página web, no al socket."""
    url = build_connection_url(port)
    png_bytes = generate_qr_png_bytes(url)
    return Response(content=png_bytes, media_type="image/png")


# ---------------------------------------------------------------------
# Campañas
# ---------------------------------------------------------------------

@app.get("/campaigns/default", response_model=schemas.Campaign)
def get_default_campaign(db: Session = Depends(get_db)):
    campaign = crud.get_or_create_default_campaign(db)
    return campaign


# ---------------------------------------------------------------------
# Personajes / monstruos
# ---------------------------------------------------------------------

@app.get("/campaigns/{campaign_id}/characters", response_model=list[schemas.Character])
def list_characters(campaign_id: int, db: Session = Depends(get_db)):
    return crud.list_characters(db, campaign_id)


@app.post("/campaigns/{campaign_id}/characters", response_model=schemas.Character)
async def create_character(
    campaign_id: int, data: schemas.CharacterCreate, db: Session = Depends(get_db)
):
    if not crud.get_campaign(db, campaign_id):
        raise HTTPException(404, "Campaña no encontrada")
    char = crud.create_character(db, campaign_id, data)
    await broadcast_state(db, campaign_id)
    return char


@app.patch("/characters/{character_id}", response_model=schemas.Character)
async def update_character(
    character_id: int, data: schemas.CharacterUpdate, db: Session = Depends(get_db)
):
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(404, "Personaje no encontrado")
    char = crud.update_character(db, char, data)
    await broadcast_state(db, char.campaign_id)
    return char


@app.post("/characters/{character_id}/hp", response_model=schemas.Character)
async def change_hp(
    character_id: int, data: schemas.HPDelta, db: Session = Depends(get_db)
):
    """Aplica +1/+5/+10/-1/-5/-10 o cualquier delta manual de HP."""
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(404, "Personaje no encontrado")
    char = crud.apply_hp_delta(db, char, data.delta)
    await broadcast_state(db, char.campaign_id)
    return char


@app.post("/characters/{character_id}/temp-hp", response_model=schemas.Character)
async def add_temp_hp(
    character_id: int, data: schemas.TempHPAdd, db: Session = Depends(get_db)
):
    """Fija los HP temporales (escudo) al valor nuevo, pero solo si es
    mayor al que ya tenía — los HP temporales no se acumulan, se toma
    el más alto. Cualquiera (DM o jugador) puede pedir esto."""
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(404, "Personaje no encontrado")
    char = crud.add_temp_hp(db, char, data.amount)
    await broadcast_state(db, char.campaign_id)
    return char


@app.post("/characters/{character_id}/armor-class", response_model=schemas.Character)
async def set_armor_class(
    character_id: int, data: schemas.ArmorClassSet, db: Session = Depends(get_db)
):
    """Fija la CA. Solo informativa (no altera ningún cálculo); la puede
    pedir cualquiera (DM o jugador), igual que /temp-hp."""
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(404, "Personaje no encontrado")
    char = crud.set_armor_class(db, char, data.value)
    await broadcast_state(db, char.campaign_id)
    return char


@app.delete("/characters/{character_id}")
async def delete_character(character_id: int, db: Session = Depends(get_db)):
    char = crud.get_character(db, character_id)
    if not char:
        raise HTTPException(404, "Personaje no encontrado")
    campaign_id = char.campaign_id
    crud.delete_character(db, char)
    await broadcast_state(db, campaign_id)
    return {"ok": True}


# ---------------------------------------------------------------------
# WebSocket — sincronización en tiempo real
# ---------------------------------------------------------------------

@app.websocket("/ws/{campaign_id}")
async def websocket_endpoint(websocket: WebSocket, campaign_id: int):
    db = next(get_db())
    await manager.connect(campaign_id, websocket)
    try:
        # Al conectar, enviamos el estado actual (soporta reconexión automática)
        await broadcast_state(db, campaign_id)

        while True:
            message = await websocket.receive_json()
            action = message.get("action")
            payload = message.get("payload") or {}

            try:
                if action == "hp_delta":
                    char = crud.get_character(db, payload["character_id"])
                    if char:
                        crud.apply_hp_delta(db, char, payload["delta"])

                elif action == "add_temp_hp":
                    char = crud.get_character(db, payload["character_id"])
                    if char:
                        crud.add_temp_hp(db, char, payload["amount"])

                elif action == "set_armor_class":
                    char = crud.get_character(db, payload["character_id"])
                    if char:
                        crud.set_armor_class(db, char, payload["value"])

                elif action == "update_character":
                    char = crud.get_character(db, payload["character_id"])
                    if char:
                        update = schemas.CharacterUpdate(**payload.get("data", {}))
                        crud.update_character(db, char, update)

                elif action == "create_character":
                    create_data = schemas.CharacterCreate(**payload)
                    crud.create_character(db, campaign_id, create_data)

                elif action == "delete_character":
                    char = crud.get_character(db, payload["character_id"])
                    if char:
                        crud.delete_character(db, char)

                await broadcast_state(db, campaign_id)

            except Exception as exc:  # payload inválido, etc.
                await websocket.send_json(
                    {"action": "error", "payload": {"message": str(exc)}}
                )

    except WebSocketDisconnect:
        manager.disconnect(campaign_id, websocket)
        await broadcast_state(db, campaign_id)
    finally:
        db.close()


# ---------------------------------------------------------------------
# Frontend (PWA) — reemplaza a la app de Expo/React Native
# ---------------------------------------------------------------------
# Montado al final a propósito: FastAPI prueba las rutas en el orden en
# que se registran, así que todo lo de arriba (/campaigns, /characters,
# /ws/{campaign_id}, /connection-info, /connection-qr.png) sigue
# matcheando primero. Cualquier otro path (la página, el JS, el CSS,
# los íconos) cae en este Mount y lo sirve StaticFiles. html=True hace
# que "/" devuelva index.html.
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="pwa")
