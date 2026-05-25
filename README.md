# Focus Blocker Pro

Extension de navegador para bloquear sitios distractores y proteger sesiones de concentracion mediante retos matematicos, desbloqueos temporales, intencion escrita y metricas de uso.

## Descripcion

Focus Blocker Pro ayuda a reducir visitas impulsivas a sitios web configurados por el usuario. Cuando una pagina bloqueada intenta abrirse, la extension redirige a una pantalla de pausa consciente donde se debe resolver un reto matematico y, opcionalmente, escribir una intencion concreta antes de obtener un desbloqueo temporal.

El objetivo no es impedir el acceso para siempre, sino agregar friccion suficiente para que el usuario recupere control sobre la decision.

## Caracteristicas

- Bloqueo por dominio y subdominios.
- Lista inicial con presets de sitios distractores comunes.
- Pagina de bloqueo con reto matematico de dificultad adaptable.
- Penalizacion incremental cuando se falla un reto.
- Desbloqueo temporal configurable.
- Intencion escrita antes de desbloquear.
- Modo de bloqueo global.
- Sesiones estrictas de enfoque desde el popup.
- Dashboard de administracion con metricas, actividad reciente e historial de intenciones.
- Exportacion de datos en JSON.
- Almacenamiento local/sincronizado con `chrome.storage.sync`.

## Estructura del proyecto

```text
focus-blocker-extension/
├── blocked.html
├── dashboard.html
├── manifest.json
├── popup.html
├── README.md
└── src/
    ├── css/
    │   ├── blocked.css
    │   ├── dashboard.css
    │   └── popup.css
    └── js/
        ├── background.js
        ├── blocked.js
        ├── dashboard.js
        ├── popup.js
        └── utils.js
```

## Instalacion en Chrome o Edge

1. Clona o descarga este repositorio.
2. Abre `chrome://extensions` o `edge://extensions`.
3. Activa el modo desarrollador.
4. Selecciona **Cargar extension sin empaquetar**.
5. Elige la carpeta raiz del proyecto.

## Uso

Desde el popup puedes:

- Activar o revisar el estado del bloqueo global.
- Iniciar una sesion estricta de enfoque.
- Agregar un dominio manualmente.
- Bloquear la pestana actual.
- Abrir el dashboard de administracion.

Desde el dashboard puedes:

- Administrar la lista de dominios.
- Ajustar dificultad, tiempo de desbloqueo y penalizacion.
- Exigir o desactivar la intencion escrita.
- Revisar metricas de bloqueos, desbloqueos y actividad reciente.
- Exportar la configuracion y datos de uso.

## Flujo de bloqueo

1. El service worker detecta la navegacion hacia un dominio bloqueado.
2. La pestana se redirige a `blocked.html`.
3. El usuario resuelve un reto matematico.
4. Si esta activado, debe escribir una intencion concreta.
5. Si falla, se aplica una demora incremental.
6. Si acierta, el sitio queda desbloqueado durante el tiempo configurado.

## Tecnologias

- Manifest V3.
- JavaScript vanilla.
- HTML y CSS sin framework.
- `chrome.storage.sync` para configuracion, sitios, desbloqueos y metricas.
- Service worker de extension para monitoreo de navegacion.

## Desarrollo

No requiere proceso de build. La extension se ejecuta directamente desde los archivos fuente.

Para validar sintaxis de JavaScript puedes ejecutar:

```bash
node --check src/js/utils.js
node --check src/js/background.js
node --check src/js/blocked.js
node --check src/js/popup.js
node --check src/js/dashboard.js
```

## Permisos

La extension solicita:

- `storage`: guardar configuracion, sitios bloqueados, desbloqueos temporales y metricas.
- `tabs`: consultar y redirigir pestanas cuando se detecta un sitio bloqueado.
- `<all_urls>`: evaluar las URLs visitadas y aplicar bloqueo en cualquier dominio configurado.

