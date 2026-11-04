# Atmosphere

Live weather for Cameroon's 10 regional capitals plus **community weather reports** ("what locals see"),
built on a serverless AWS backend with SAM.

- **Frontend** (`frontend/`): static HTML/CSS/JS with animated weather icons, hourly and 7-day forecasts, and a reports feed.
- **Backend** (`src/`, `template.yaml`): API Gateway + Lambda (Python 3.13) + DynamoDB.
- **Weather data**: [Open-Meteo](https://open-meteo.com/) (free, no API key, CC BY 4.0).

| Method | Path                    | Lambda              | What it does                                             |
| ------ | ----------------------- | ------------------- | -------------------------------------------------------- |
| POST   | `/create-weather`       | `create_weather.py` | Create a report, returns an `edit_token`                 |
| GET    | `/weathers?town=Douala` | `get_weathers.py`   | List reports, newest first (optional town filter)        |
| GET    | `/weather/{id}`         | `get_weather.py`    | Get one report                                           |
| PUT    | `/weather/{id}`         | `update_weather.py` | Edit a report (needs `X-Edit-Token` header)              |
| DELETE | `/weather/{id}`         | `delete_weather.py` | Delete a report (needs `X-Edit-Token` header)            |
| GET    | `/forecast?city=Douala` | `get_forecast.py`   | Live forecast from Open-Meteo (no `city` = all capitals) |

Report body: `{"town": "Douala", "weather": "rainy", "temperature": 26, "note": "...", "reporter": "..."}`
where `weather` is one of `sunny, partly_cloudy, cloudy, rainy, stormy, foggy, windy`.

## Run locally (no AWS needed)

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r tests/requirements.txt
.venv/Scripts/python local/dev_server.py --seed        # API on http://localhost:3000 (in-memory DynamoDB)
python -m http.server 5500 --directory frontend        # open http://localhost:5500
```

## Test

```bash
.venv/Scripts/python -m pytest tests/unit -v
```

## Deploy

```bash
sam build
sam deploy --guided
```

Then set `API_BASE` in `frontend/config.js` to the `WeatherApiUrl` output and host `frontend/` (e.g. S3 + CloudFront).

---
