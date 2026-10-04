# Roam India

A responsive travel-guide website with a Flask API. Visitors can search destinations, choose a language and narration style, and generate a written guide. Audio is available when a Murf API key is configured.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python Backend/app.py
```

Open <http://127.0.0.1:5000> in a browser. Do not open the HTML file directly: the guide generator needs the Flask server.

## Optional AI services

The site works without API keys using local guide text. To enable live descriptions and audio, set environment variables before starting the server:

```powershell
$env:GEMINI_API_KEY = "your-gemini-key"
$env:MURF_API_KEY = "your-murf-key"
python Backend/app.py
```

Never commit API keys to this repository. If keys were previously added to a file or commit, rotate them in the provider dashboards.

## Endpoints

- `GET /` — application
- `GET /health` — service status
- `POST /generate-audio-guide` — creates a guide
