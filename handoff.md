# Handoff — Dungeons & Phones

> **Actualización posterior a este handoff**: se abandonó por completo
> el enfoque de `mobile/` (React Native + Expo + EAS Build) descrito
> más abajo. Motivo: dependency hell recurrente (Expo SDK, Reanimated,
> Skia, EAS) para una app que solo necesita hablar por WebSocket con
> una PC en la misma red WiFi — nada de eso requiere un binario
> nativo. Se reemplazó por una **PWA** servida directamente por el
> backend FastAPI (`backend/app/static/`): HTML/CSS/JS plano, sin
> build, instalable en el celular con "Agregar a pantalla de inicio".
> El backend (todo lo descrito abajo sobre `main.py`, el contrato
> WebSocket, `hp_status.py`, etc.) **no cambió** — la PWA consume
> exactamente los mismos endpoints y mensajes WS que ya estaban
> diseñados para `mobile/`. Ver `README.md` para el detalle del nuevo
> flujo. El resto de este documento describe el diseño original de
> `mobile/`, que queda como referencia histórica de por qué se llegó
> hasta acá, aunque esa carpeta ya no existe en el proyecto.

## Qué estamos construyendo

App de D&D con dos partes que corren en la misma red WiFi:

- **Backend** (`backend/`): FastAPI + WebSockets + SQLite, corre en la
  PC del DM. Es la única fuente de verdad — guarda campaña,
  personajes, monstruos, HP e iniciativa entre sesiones.
- **Mobile** (`mobile/`): app React Native + Expo (TypeScript) que
  corre en los celulares de jugadores y DM, y habla con la PC por
  WebSocket para ver y modificar el estado en tiempo real.

Ya está resuelto el roadmap de Fases 1–3 del plan original (backend,
UI pixel art, conexión por QR, persistencia, reconexión automática).
Lo que quedó pendiente y en lo que estuvimos iterando en las últimas
vueltas es específicamente **cómo se empaqueta y distribuye la app
móvil**, y cómo eso se conecta con el backend.

## Por qué tocamos la sección de mobile

Dos problemas concretos, en este orden:

1. **El backend no arrancaba en Python 3.14** porque `requirements.txt`
   fijaba `pydantic==2.9.2`, que no tiene wheel precompilada para esa
   versión de Python e intentaba compilar con Rust y fallaba. Se
   solucionó destrabando versiones (`>=` en vez de `==`) para que pip
   traiga wheels compatibles con 3.14. **Esto ya está resuelto**, no
   requiere más trabajo.

2. **La app móvil dependía de Expo Go** (la app genérica de Expo para
   probar proyectos) para correr. El pedido explícito fue: no usar una
   app ajena — el jugador/DM tiene que poder instalar **Dungeons &
   Phones como una app propia**, con su ícono, directo en el celular.

   Esto se resolvió cambiando el flujo de "abrir el proyecto en Expo
   Go" a **compilar un APK real con EAS Build** (herramienta oficial
   de Expo para generar binarios nativos `.apk`/`.ipa`). Se actualizó:
   - `mobile/package.json` → Expo SDK 55 estable (React Native 0.83,
     Nueva Arquitectura), se sacó `expo-barcode-scanner` (deprecado y
     sin uso real, `expo-camera` ya cubre el escaneo de QR).
   - `mobile/eas.json` (nuevo) → perfil `preview` que genera un `.apk`
     de distribución interna, instalable directo sin pasar por Google
     Play.
   - `assets/sprites/icon.png`, `adaptive-icon.png`, `splash.png`
     (nuevos, placeholders generados) para que el build no falle por
     assets faltantes.
   - `README.md` → instrucciones actualizadas: `eas login` →
     `eas build:configure` → `eas build --platform android --profile
     preview`, con alternativa local (`--local`) para no depender de
     la nube de Expo, y nota sobre la restricción de Apple para iOS
     (cuenta de desarrollador paga para instalar sin TestFlight).

## Cómo se relacionan mobile y backend

La relación es **cliente-servidor sobre WiFi local**, sin ningún
servicio en la nube de por medio para el uso normal de la app (EAS
solo se usa una vez, para compilar el binario; después el APK
instalado no depende de EAS para nada).

```
PC del DM                              Celulares (jugador / DM)
┌─────────────────────┐                ┌──────────────────────────┐
│ backend/ (FastAPI)   │                │ App instalada (APK)       │
│  - SQLite            │  WiFi local    │  - RoleSelect → Connect   │
│  - REST (/campaigns,  │◄──────────────►│  - WebSocketContext.tsx   │
│    /characters, ...)  │   WebSocket    │    conecta a ws://IP:8000 │
│  - WS /ws/{campaign}  │  ws://IP:8000  │  - Player / DM screens    │
│  - QR con la IP local │                │                            │
└─────────────────────┘                └──────────────────────────┘
```

Puntos concretos de esa relación (código ya implementado):

- **Descubrimiento/conexión**: `backend/app/qr_utils.py` detecta la IP
  local de la PC y genera un QR (`GET /connection-qr.png`) que
  codifica `ws://<ip>:8000`. En el celular, `ConnectScreen.tsx`
  escanea ese QR (o permite tipear la IP a mano) y se lo pasa a
  `WebSocketContext.connect(url)`.
- **Canal en tiempo real**: `WebSocketContext.tsx` abre
  `ws://<ip>:8000/ws/{campaign_id}` (campaign_id fijo = 1 en este MVP).
  El backend (`main.py`, endpoint `websocket_endpoint`) mantiene la
  conexión, recibe acciones (`hp_delta`, `create_character`,
  `update_character`, `delete_character`) y responde con un snapshot
  completo (`action: "state"`) que se hace *broadcast* a todos los
  dispositivos conectados a esa campaña — así todos los celulares ven
  el mismo estado al instante.
- **Reconexión**: si se corta el WiFi, `WebSocketContext.tsx`
  reintenta conectar solo cada 2s (`RECONNECT_DELAY_MS`) hasta que el
  backend vuelva a estar disponible; no se pierde estado porque el
  backend persiste todo en SQLite.
- **Reglas de negocio compartidas**: el cálculo de estado de HP
  (Full/Staggered/Critical/Dead y sus colores) está duplicado a
  propósito en `backend/app/hp_status.py` y
  `mobile/src/utils/hpStatus.ts`, para que el celular pueda animar de
  forma optimista sin esperar la respuesta del servidor, y el backend
  siga siendo la fuente de verdad final en cada broadcast.

## Ajuste posterior: conflicto de dependencias al instalar

Al correr `npm install` apareció un `ERESOLVE`:
`@shopify/react-native-skia@2.0.7` declara como peer dependency
`react-native-reanimated@^3.0`, pero el proyecto usa Reanimated 4
(requerido por Expo SDK 55). Es un desfasaje de metadata de esa
versión de Skia — las versiones actuales de Skia sí soportan
Reanimated 4 en la práctica.

Como `@shopify/react-native-skia` **no se usaba en ningún componente
todavía** (solo se mencionaba en un comentario como idea futura para
un shader de escala de grises), se sacó directamente de
`mobile/package.json` en vez de perseguir la versión exacta
compatible. Si en el futuro se necesita Skia de verdad, instalar con
`npx expo install @shopify/react-native-skia` para que Expo resuelva
automáticamente una versión compatible con Reanimated 4.

## Estado actual (checklist)

- [x] Backend arranca en Python 3.14 (requirements destrabados).
- [x] WebSocket + REST + persistencia SQLite funcionando end-to-end en el diseño.
- [x] UI pixel art (barras animadas, partículas, estados, sprites placeholder).
- [x] QR de conexión + reconexión automática.
- [x] Config de build standalone (EAS) lista: `eas.json`, ícono/splash placeholder, versiones de SDK 55.
- [ ] **No ejecutado todavía en un dispositivo/entorno real** — todo esto se armó y verificó por sintaxis/estructura, pero nadie corrió `eas build` ni probó el APK en un celular físico ni contra el backend real.
- [ ] Reemplazar íconos/splash y sprites placeholder por arte pixel art real.
- [ ] Fase 4 del plan original (sonidos retro) y "mejoras futuras" (dados, historial visual, múltiples campañas, pantalla TV) — no iniciadas.

## Próximos pasos sugeridos

1. Correr el backend localmente (`python run.py`) y confirmar que
   levanta sin errores con las nuevas versiones de `requirements.txt`.
2. `cd mobile && npm install && npx expo install --fix` para que se
   resuelvan las versiones exactas de todas las libs nativas.
3. `eas login` + `eas build:configure` (esto va a pedir crear/vincular
   un proyecto en expo.dev y actualizará `extra.eas.projectId` en
   `app.json`).
4. `eas build --platform android --profile preview` y probar el APK
   resultante contra el backend corriendo en la misma red.
5. Si algo del protocolo WS no calza en la práctica (payloads,
   nombres de acciones), ajustar en paralelo `backend/app/main.py` y
   `mobile/src/context/WebSocketContext.tsx`, que son los dos lados
   del mismo contrato.
