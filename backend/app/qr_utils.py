import io
import socket

import qrcode
from zeroconf import Zeroconf, ServiceInfo

# Nombre mDNS fijo del servidor. Los celulares en la misma red WiFi lo
# resuelven vía mDNS/Bonjour a la IP que tenga la PC en ese momento, así
# que el link que usan los jugadores no cambia aunque cambie de red o
# le cambie la IP por DHCP — mientras el programa esté corriendo en la
# PC del DM y anunciando este nombre, el link sigue sirviendo.
MDNS_HOSTNAME = "dungeonsandphones"


def get_local_ip() -> str:
    """
    Obtiene la IP local de la PC en la red WiFi.
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
    """URL genérica (mDNS) que el celular abre en el navegador para
    cargar la PWA. No depende de la IP actual de la PC: mientras
    `start_mdns_advertiser()` esté corriendo, este hostname siempre
    resuelve a la PC del DM en la red local.

    La página, una vez cargada, arma su propio ws://<mismo host>/ws/
    {campaign_id} en el JS del cliente (ver static/js/ws.js), así que
    esta función ya no necesita devolver un ws:// crudo.
    """
    return f"http://{MDNS_HOSTNAME}.local:{port}"


def build_fallback_ip_url(port: int = 8000) -> str:
    """URL directa por IP, como respaldo por si algún celular no
    resuelve mDNS/.local (pasa en algunas redes WiFi de hoteles,
    universidades o corporativas que bloquean multicast, o en algunos
    Android viejos). Esta sí cambia si la PC cambia de red."""
    ip = get_local_ip()
    return f"http://{ip}:{port}"


def start_mdns_advertiser(port: int = 8000) -> Zeroconf:
    """Anuncia `MDNS_HOSTNAME.local` en la red apuntando a la IP local
    actual. Devuelve el objeto `Zeroconf` — hay que llamar a
    `.close()` sobre él al apagar el servidor para dejar de anunciar
    el nombre prolijamente (si el proceso muere de golpe, el registro
    igual expira solo por TTL).
    """
    zeroconf = Zeroconf()
    ip = get_local_ip()
    info = ServiceInfo(
        "_http._tcp.local.",
        f"{MDNS_HOSTNAME}._http._tcp.local.",
        addresses=[socket.inet_aton(ip)],
        port=port,
        server=f"{MDNS_HOSTNAME}.local.",
    )
    zeroconf.register_service(info)
    return zeroconf


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
