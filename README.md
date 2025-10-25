# Daily Open Source Learning

Automatiza **commits útiles** que documentan tu aprendizaje y te **notifican al celular** con noticias tech en español.

- 📗 **English word of the day** (con ejemplo)
- 🤖 **AI tip** corto y accionable
- 💻 **Coding prompt** (reto breve)
- 🗞️ **Tech news en español**, de **fuentes confiables**, filtradas por **año actual** y **recencia** (deduplicadas), enviadas a **Telegram** y guardadas en `data/news.md`

> Todo se actualiza automáticamente con **GitHub Actions** y se registra en [`data/log.md`](data/log.md).\
> La **primera ejecución del día** también inserta la noticia dentro del bloque diario de `log.md`.

---

## Cómo usarlo

1. Crea un repositorio en GitHub (público o privado).
2. Sube los archivos del proyecto (o usa `git push` desde tu máquina).
3. En **Settings → Secrets and variables → Actions** agrega estos **Repository secrets**:
   - `TELEGRAM_TOKEN` → token completo de tu bot (de @BotFather, incluye los dígitos, el `:` y lo que sigue).
   - `TELEGRAM_CHAT_ID` → tu chat\_id (escribe **/start** al bot y obtén el id con `getUpdates`).
4. Verifica el cron del workflow en `.github/workflows/daily-commit.yml` (por defecto 3× al día):
   ```yaml
   on:
     schedule:
       - cron: "0 13,19,1 * * *"  # 08:00, 14:00, 20:00 Lima (UTC-5) en UTC
     workflow_dispatch:
   ```
5. ¡Listo! En **Actions** verás las ejecuciones y empezarás a recibir noticias en Telegram.

---

## Configuración (variables opcionales)

Puedes ajustar el comportamiento sin tocar el código, usando **ENV vars** (en tu Action o local):

| Variable                 | Default   | Descripción                                                                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NEWS_ONLY_CURRENT_YEAR` | `true`    | Si `true`, solo noticias del **año actual**.                                                                                 |
| `NEWS_RECENT_DAYS`       | `30`      | Requiere que la noticia sea de los **últimos N días**.                                                                       |
| `NEWS_RELAXED_DAYS`      | `90`      | Fallback si no hay candidatas recientes (relaja a N días).                                                                   |
| `NEWS_PICK_TOP_N`        | `10`      | Entre las más recientes, elige la primera no vista dentro del top N.                                                         |
| `FORCE_LEARNING`         | *(vacío)* | Si la seteas a cualquier valor, **fuerza** a escribir el bloque de `log.md` aunque ya exista el del día (útil para pruebas). |

---

## Ejecutar localmente

```bash
# Variables de entorno (ejemplo PowerShell Windows):
$env:TELEGRAM_TOKEN="1234567890:AA-TOKEN_COMPLETO"
$env:TELEGRAM_CHAT_ID="7311504169"

# Ejecutar
node scripts/update.cjs

# (Opcional) commit local
git add .
git commit -m "chore(daily): update log & news"
```

> Puedes personalizar los contenidos en `data/*.json` para tu plan de aprendizaje.

---

## ¿Qué archivos hace/actualiza?

- `data/log.md` → registro diario de **word/tip/prompt** (idempotente: 1 vez al día).
- `data/news.md` → historial de noticias (se agrega en **cada ejecución**).
- `data/news_state.json` → memoria para **deduplicar** por link y título.
- `README.md` → actualiza la línea de “Última actualización automática”.
- `.github/workflows/daily-commit.yml` → cron, Node 20, commit automático si hay cambios.

---

## Fuentes de noticias (ES)

Xataka, Xataka Android, Xataka Móvil, Genbeta, Hipertextual, El Español (Tecnología), El País (Tecnología), elDiario.es (Tecnología), Xataka México, Xataka Basics, ComputerHoy, MuyComputerPro.

> El script ignora fuentes caídas, aplica **timeout + reintento**, ordena por fecha y filtra por año/recencia.

---

## Troubleshooting rápido

- **“Bad Request: chat not found”** → abre el chat con tu bot y envía **/start**; usa el `chat_id` correcto (de `getUpdates`).
- **No llegan mensajes** → revisa `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID` en **Secrets**; prueba manual con `sendMessage`.
- **No hay noticias** → puede que no existan artículos en el rango. Ajusta `NEWS_RECENT_DAYS` o `RELAXED_DAYS`.

---

> Última actualización automática: 2025-10-25

---

### Licencia

MIT

