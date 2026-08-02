"""
Gestiona las conexiones WebSocket activas por campaña y permite
hacer broadcast del estado a todos los teléfonos conectados.
"""
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # campaign_id -> lista de websockets conectados
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, campaign_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(campaign_id, []).append(websocket)

    def disconnect(self, campaign_id: int, websocket: WebSocket) -> None:
        conns = self.active_connections.get(campaign_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns and campaign_id in self.active_connections:
            del self.active_connections[campaign_id]

    async def broadcast(self, campaign_id: int, message: dict) -> None:
        """Envía un mensaje a todos los clientes conectados a esta campaña."""
        dead_connections = []
        for connection in self.active_connections.get(campaign_id, []):
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(campaign_id, dead)

    def connection_count(self, campaign_id: int) -> int:
        return len(self.active_connections.get(campaign_id, []))


manager = ConnectionManager()
