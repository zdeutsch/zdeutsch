# ZDeutsch (Static Site + Express API)

This project now includes:

- Static public website served from `site/`.
- Static manager dashboard served from `dashboard/` (Bootstrap UI).
- Express API for reading/updating files in `site/database/`.

## Run

```bash
npm install
npm start
```

Server defaults to `http://localhost:3030`.

- Public site: `http://localhost:3030/`
- Manager dashboard: `http://localhost:3030/dashboard`

## Docker (zdeutsch.localhost)

```bash
docker compose up --build -d
```

Default Docker URLs:

- Public site: `http://zdeutsch.localhost/`
- Manager dashboard: `http://zdeutsch.localhost/dashboard`
- API health: `http://zdeutsch.localhost/api/health`

Also available:

- `http://localhost/`
- `http://localhost:3030/`

Optional port overrides:

```bash
WEB_PORT=8080 APP_PORT=3031 docker compose up --build -d
```

## Architecture

- `server/config`: paths and environment.
- `server/repositories`: low-level JSON read/write.
- `server/services`: database business logic by module.
- `server/routes/api`: API endpoints.
- `server/middleware`: async and error handlers.

## API Endpoints

- `GET /api/health`
- `GET /api/overview`
- `GET /api/files`
- `GET /api/files/:fileKey`
- `PUT /api/files/:fileKey`
- `GET /api/config`
- `PUT /api/config`
- `GET /api/lesen/themes?level=b1|b2`
- `GET /api/lesen/theme?level=...&themeKey=...`
- `GET /api/lesen/versions?level=...&themeKey=...`
- `GET /api/lesen/part?level=...&themeKey=...&versionKey=default&partKey=...`
- `POST /api/lesen/theme`
- `PUT /api/lesen/theme`
- `POST /api/lesen/version`
- `PUT /api/lesen/version`
- `PUT /api/lesen/version/theme` (move a version into another theme group)
- `DELETE /api/lesen/version`
- `PUT /api/lesen/part`
- `DELETE /api/lesen/theme`
- `GET /api/horen/topics?level=...&part=...&themeKey=...`
- `POST /api/horen/topics`
- `PUT /api/horen/topics/:topicId`
- `DELETE /api/horen/topics/:topicId`
- `GET /api/shreiben/tasks?level=...`
- `POST /api/shreiben/extract-task`
- `POST /api/shreiben/tasks`
- `PUT /api/shreiben/tasks/:taskId`
- `DELETE /api/shreiben/tasks/:taskId`

### Windows Git push repair

On the Windows dashboard host, run this once from PowerShell after the project has been copied to `C:\Users\Hp\ZDeutschManager`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\windows\configure-git-push.ps1
```

The script sets the repository remote to GitHub, configures the dashboard SSH key, and verifies `git ls-remote`. If the key is new, it prints the public key that must be added to the write-enabled GitHub account before publishing can succeed.

## Notes

- Updates are written directly to JSON files under `site/database`.
- JSON writes are atomic (temp file + rename).
- The public website remains static and unchanged in behavior.
- `POST /api/shreiben/extract-task` requires `OPENAI_API_KEY` in the server environment.
- Schreiben task shape is markdown-only: `title`, `istructions`, `content`, `tasks`.
- Dedicated Lesen part editors are available at:
  - `/dashboard/lesen-teil-1.html`
  - `/dashboard/lesen-teil-2.html`
  - `/dashboard/lesen-teil-3.html`
  - `/dashboard/lesen-sprach-1.html`
  - `/dashboard/lesen-sprach-2.html`
