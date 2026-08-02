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
- Imprime la IP local de la PC y la URL que hay que abrir en el celular
  (`http://<ip>:8000`).
- Genera `connection_qr.png` con el QR de esa URL, y lo sirve también
  en `http://<ip>:8000/connection-qr.png` para mostrarlo en pantalla.