"""
Punto de entrada para el DM: levanta el servidor y muestra por
consola la IP local + URL de conexión (y guarda un QR en disco)
para que los jugadores conecten sus teléfonos fácilmente.

Uso:
    python run.py
"""
import uvicorn

from app.qr_utils import (
    get_local_ip,
    build_connection_url,
    build_fallback_ip_url,
    generate_qr_png_bytes,
    start_mdns_advertiser,
)

PORT = 8000

if __name__ == "__main__":
    ip = get_local_ip()
    url = build_connection_url(PORT)
    fallback_url = build_fallback_ip_url(PORT)

    # Anuncia el hostname mDNS (dungeonsandphones.local) en la red WiFi
    # local para que `url` funcione siempre, sin importar qué IP le
    # toque a la PC. Se cierra prolijamente al frenar el server (Ctrl+C).
    zeroconf = start_mdns_advertiser(PORT)

    qr_path = "connection_qr.png"
    with open(qr_path, "wb") as f:
        f.write(generate_qr_png_bytes(url))

    print("=" * 50)
    print("  DUNGEONS & PHONES — Servidor del DM")
    print("=" * 50)
    print(f"  Abrir en el celular: {url}")
    print(f"  QR guardado en:  {qr_path}")
    print(f"  También podés verlo en: http://{ip}:{PORT}/connection-qr.png")
    print()
    print(f"  Si el link de arriba no conecta (pasa en algunas redes")
    print(f"  WiFi que bloquean mDNS), probá con la IP directa:")
    print(f"    {fallback_url}")
    print("=" * 50)

    try:
        uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)
    finally:
        zeroconf.close()
