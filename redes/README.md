# Publicar los videos en redes con Postiz

Esta carpeta levanta [Postiz](https://github.com/gitroomhq/postiz-app) (open source, AGPL-3.0) para subir y
programar los videos en Instagram, YouTube, TikTok y Facebook, y para que un agente de IA (Claude Code u otro)
lo maneje. Corre igual en tu computadora y en un VPS con Linux: lo único que cambia entre los dos es `.env`.

```
docker-compose.yml   los servicios de Postiz: la app, sus bases de datos y Temporal (+ Caddy en el VPS)
.env.example         plantilla de configuración; scripts/preparar.sh crea .env a partir de ella
Caddyfile            HTTPS automático en el VPS
dynamicconfig/       configuración de Temporal, copiada del compose oficial
scripts/
  preparar.sh        crea .env con contraseñas nuevas
  respaldar.sh       copia de seguridad de todos los datos (también sirve para mudarse)
  restaurar.sh       carga un respaldo en una instalación nueva
  cambiar-url.sh     corrige las direcciones de los videos después de mudarse
```

## Por qué Docker

Postiz no es un solo programa: son nueve servicios (la app, dos PostgreSQL, Redis, Elasticsearch, Temporal y
sus herramientas). Docker los empaqueta con sus versiones exactas y `docker-compose.yml` los describe a todos.
Así se instala con un comando sin ensuciar tu sistema, en el VPS corre exactamente lo mismo que en tu
computadora y los datos viven en volúmenes que se respaldan y se mudan con un script.

## 1. Instalar Docker

- **Linux (Ubuntu):** `curl -fsSL https://get.docker.com | sh`, luego `sudo usermod -aG docker $USER` y vuelve
  a iniciar sesión.
- **Mac:** Docker Desktop, con al menos 4 GB de memoria en Settings → Resources.
- **Windows:** instala WSL2 con Ubuntu (`wsl --install` en PowerShell) y Docker Desktop con la integración de
  WSL activada. Clona el repo y corre todo desde la terminal de Ubuntu, dentro de tu carpeta de Linux (`~/`),
  no en `C:\`.

Postiz usa unos 3 GB de RAM y las imágenes ocupan unos 12 GB de disco.

## 2. Arrancar en tu computadora

```bash
cd redes
./scripts/preparar.sh     # crea .env con contraseñas nuevas
docker compose up -d      # la primera vez descarga las imágenes y tarda unos minutos
```

Abre **http://localhost:4007** y crea tu cuenta. Entra siempre con la misma dirección de `POSTIZ_URL`: con otra
(la IP de tu red, por ejemplo) la sesión no se guarda. Cuando ya tengas tu cuenta, pon
`DISABLE_REGISTRATION=true` en `.env` y aplica con `docker compose up -d`.

```bash
docker compose ps                # estado de cada servicio
docker compose logs -f postiz    # qué está pasando
docker compose down              # detener (los datos se quedan en los volúmenes)
```

El panel de Temporal (`http://localhost:8080`) muestra las publicaciones programadas y las que fallaron.

## 3. Conectar las plataformas

Cada plataforma te pide crear una app de desarrollador. Pon sus llaves en `.env` y aplica con
`docker compose up -d`. La dirección de retorno (redirect URI) que te piden es `POSTIZ_URL` más la ruta de la
tabla, por ejemplo `http://localhost:4007/integrations/social/youtube`.

| Plataforma | Dónde se crea la app | Ruta de retorno | En tu computadora |
|---|---|---|---|
| YouTube | Google Cloud Console: activa YouTube Data API v3, crea un cliente OAuth de tipo "Aplicación web" y agrégate como usuario de prueba | `/integrations/social/youtube` | Funciona completo |
| Facebook | developers.facebook.com: app de tipo "Otro" con Facebook Login for Business | `/integrations/social/facebook` | Conecta, pero no publica videos |
| Instagram | La misma app de Meta. La cuenta tiene que ser profesional y estar unida a una página de Facebook | `/integrations/social/instagram` | Conecta, pero no publica videos |
| TikTok | developers.tiktok.com: Login Kit y Content Posting API con Direct Post | `/integrations/social/tiktok` | No: TikTok exige HTTPS |

Por qué Instagram y Facebook no publican desde tu computadora: Meta descarga el video desde la dirección que le
da Postiz (`http://localhost:4007/uploads/...`), y desde internet esa dirección no existe. YouTube y TikTok
reciben el archivo directamente. En el VPS funcionan las cuatro.

Límites de cada plataforma que conviene saber desde el principio:

- **TikTok:** hasta que TikTok apruebe tu app (audit, se pide desde el portal), todo se publica en privado y
  con un máximo de 5 cuentas por día.
- **YouTube:** mientras Google no verifique tu app, los videos subidos por API quedan privados. La cuota diaria
  por defecto alcanza para unas 6 subidas.
- **Meta:** hasta que Meta apruebe los permisos avanzados (app review), solo publican las cuentas que agregues
  como desarrolladoras o testers de la app.
- **Formato:** sube los videos en MP4 (H.264 y AAC). Para TikTok, Postiz trata como foto todo lo que no
  termina en `.mp4`.

La guía de cada plataforma, paso a paso: https://docs.postiz.com/providers/youtube (cambia `youtube` por
`facebook`, `instagram` o `tiktok`).

## 4. Conectar el agente

Saca tu llave en Postiz: **Settings → Agents → API Key → Reveal**. Esa llave da control total de tus cuentas:
no la subas a git.

**MCP**, para que el agente programe, revise y ajuste publicaciones:

```bash
claude mcp add --transport http postiz http://localhost:4007/api/mcp/TU_LLAVE
```

Por MCP solo se pueden subir videos que ya estén en una URL pública. Para los archivos de tu disco el agente
usa la CLI.

**CLI y skill**, para subir videos desde tu disco:

```bash
npm install -g postiz
export POSTIZ_API_URL=http://localhost:4007/api
export POSTIZ_API_KEY=TU_LLAVE
npx skills add gitroomhq/postiz-agent      # le enseña al agente a usar la CLI
```

El flujo que sigue el agente por cada video:

```bash
postiz upload video.mp4                    # sube el video y devuelve su path
postiz integrations:list                   # ids de tus cuentas conectadas
postiz integrations:settings <id>          # reglas y opciones de esa plataforma
postiz posts:create -t draft -i <id> -s 2026-10-20T18:00:00Z -m <path> \
  -c "Texto para esta plataforma #hashtag" --settings '{"title":"Título para YouTube","type":"public"}'
```

Pídele que cree borradores (`-t draft`) y revísalos en el calendario de Postiz antes de publicarlos.

## 5. Pasar al VPS

Necesitas un VPS con **Ubuntu 24.04 LTS, 4 GB de RAM** (con 2 GB no alcanza: en las pruebas Postiz usó casi
3 GB), 2 vCPU y 40 GB de disco, y un subdominio (por ejemplo `postiz.tudominio.com`) con un registro A que
apunte a la IP del VPS.

En el VPS:

```bash
curl -fsSL https://get.docker.com | sh
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
git clone https://github.com/rayperatta/cocardo.git && cd cocardo/redes
```

En tu computadora, respalda y copia el respaldo al VPS:

```bash
cd redes
./scripts/respaldar.sh
scp -r respaldos/<fecha> usuario@IP_DEL_VPS:~/respaldo-postiz
```

De vuelta en el VPS:

```bash
./scripts/restaurar.sh ~/respaldo-postiz
nano .env      # POSTIZ_URL=https://postiz.tudominio.com, COMPOSE_PROFILES=vps,
               # POSTIZ_DOMINIO=postiz.tudominio.com, DISABLE_REGISTRATION=true
./scripts/cambiar-url.sh http://localhost:4007
docker compose up -d
```

Caddy saca el certificado HTTPS solo. Después:

- En la app de cada plataforma agrega la ruta de retorno con tu dominio
  (`https://postiz.tudominio.com/integrations/social/...`). Las cuentas que ya conectaste siguen funcionando.
- En el agente cambia `http://localhost:4007` por `https://postiz.tudominio.com` (en `POSTIZ_API_URL` y en la
  URL del MCP).
- Postiz solo queda abierto a internet por HTTPS: los puertos 4007 y 8080 escuchan únicamente dentro del VPS.
  Para ver el panel de Temporal: `ssh -L 8080:localhost:8080 usuario@IP_DEL_VPS` y abre `http://localhost:8080`.

Si prefieres empezar de cero en el VPS, sáltate el respaldo: `./scripts/preparar.sh`, edita `.env` y
`docker compose up -d`.

## Actualizar Postiz

Respalda primero. Luego cambia `POSTIZ_VERSION` en `.env` (versiones en
https://github.com/gitroomhq/postiz-app/pkgs/container/postiz-app) y corre `docker compose pull` y
`docker compose up -d`. Revisa antes las notas de migración: https://docs.postiz.com/installation/migration.

## Problemas comunes

- **No me deja entrar o me saca:** abre Postiz con la misma dirección que tiene `POSTIZ_URL`.
- **Error 502 o página en blanco justo después de arrancar:** espera uno o dos minutos y mira
  `docker compose logs -f postiz`.
- **Postiz se reinicia una y otra vez:** al arrancar descarga una herramienta de base de datos desde npm, así
  que necesita salida a internet. Los logs dicen qué falló.
- **TikTok publica en privado:** tu app de TikTok todavía no pasa el audit.
- **Instagram dice "Insufficient developer role":** agrega tu cuenta como Instagram Tester en la app de Meta y
  acepta la invitación desde la configuración de Instagram.
