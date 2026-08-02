"""
Utilidades para detectar la IP local de la PC del DM y generar
un código QR que los teléfonos escanean para conectarse fácilmente
(Fase 3 del roadmap: "QR de conexión").
"""
import io
import socket

import qrcode


def get_local_ip() -> str:
    """
    Obtiene la IP local de la PC en la red WiFi (no la de loopback).
    Trick clásico: abrir un socket UDP hacia una IP externa (no envía
    datos realmente) para que el SO elija la interfaz de red correcta.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def build_connection_url(port: int = 8000) -> str:
    """URL que el celular abre en el navegador para cargar la PWA.

    La página, una vez cargada desde acá, arma su propio ws://<mismo
    host>/ws/{campaign_id} en el JS del cliente (ver static/js/ws.js),
    así que esta función ya no necesita devolver un ws:// crudo.
    """
    ip = get_local_ip()
    return f"http://{ip}:{port}"


def generate_qr_png_bytes(data: str) -> bytes:
    """Genera un PNG en memoria con el QR que codifica `data`."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
