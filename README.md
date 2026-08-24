# Dungeons & Phones

## Levantar todo (una sola PC, el DM)

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Esto:
- Levanta la API **y la PWA** en `http://0.0.0.0:8000` (mismo puerto).
- Anuncia el nombre `dungeonsandphones.local` en la red WiFi (vía mDNS)
  y lo imprime como la URL que hay que abrir en el celular:
  `http://dungeonsandphones.local:8000`. Este link **no cambia** aunque
  la PC cambie de red o de IP — solo hace falta que `run.py` siga
  corriendo en la PC del DM, que es quien lo anuncia.
- Genera `connection_qr.png` con el QR de esa URL, y lo sirve también
  en `http://<ip local>:8000/connection-qr.png` para mostrarlo en pantalla.
- Por las dudas, también imprime la IP directa como alternativa: en
  algunas redes WiFi (hoteles, universidades, algunas corporativas)
  el multicast que usa mDNS está bloqueado y `dungeonsandphones.local`
  no resuelve. Si a algún jugador no le carga, que use esa IP directa
  en vez del link genérico.