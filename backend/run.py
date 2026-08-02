"""
Punto de entrada para el DM: levanta el servidor y muestra por
consola la IP local + URL de conexión (y guarda un QR en disco)
para que los jugadores conecten sus teléfonos fácilmente.

Uso:
    python run.py
"""
import uvicorn

from app.qr_utils import get_local_ip, build_connection_url, generate_qr_png_bytes

PORT = 8000

if __name__ == "__main__":
    ip = get_local_ip()
    url = build_connection_url(PORT)

    qr_path = "connection_qr.png"
    with open(qr_path, "wb") as f:
        f.write(generate_qr_png_bytes(url))

    print("=" * 50)
    print("  DUNGEONS & PHONES — Servidor del DM")
    print("=" * 50)
    print(f"  IP local:        {ip}")
    print(f"  Abrir en el celular: {url}")
    print(f"  QR guardado en:  {qr_path}")
    print(f"  También podés verlo en: http://{ip}:{PORT}/connection-qr.png")
    print("=" * 50)

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)
