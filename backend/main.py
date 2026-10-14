from dotenv import load_dotenv
import os 
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone, date
import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import ollama
import re

#-------API KEY -------
load_dotenv()
WEATHER_PRIMARY_KEY = os.getenv("WEATHER_API_KEY_PRIMARY", "")
WEATHER_BACKUP_KEY = os.getenv("WEATHER_API_KEY_BACKUP", "")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()

DATABASE = "weather.db"
FAVORITE_CITIES = Path("favorite_cities.txt")

def create_database():
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS weather_readings(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                city TEXT NOT NULL COLLATE NOCASE,
                country TEXT,
                temperature REAL, 
                humidity INTEGER,
                wind_speed REAL,
                uv_index REAL,
                air_quality_index INTEGER,
                weather_code INTEGER,
                season TEXT,
                recorded_at TEXT NOT NULL
                )
        """)
create_database()

def get_season(latitude: float, current_date: date | None = None) -> str:
    dt = current_date or datetime.now(timezone.utc).date()
    month = dt.month

    if month in (12, 1, 2):
        season = "Winter"
    elif month in (3,4,5):
        season = "Spring"
    elif month in (6,7,8):
        season= "Summer"
    else:
        season = "Autumn"

    if latitude < 0:
        opposites = {"Winter" : "Summer", "Summer" : "Winter", "Spring" : "Autumn", "Autumn" : "Spring"}
        return opposites[season]
    return season

def load_favorites() -> dict[str, dict]:
    if not FAVORITE_CITIES.exists():
        return {}
    try: 
        return json.loads(FAVORITE_CITIES.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

def save_favorite(favorite: dict[str, dict]) -> None:
    FAVORITE_CITIES.write_text(
        json.dumps(favorite, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

FAVORITE = load_favorites()

app = FastAPI(title="Weather Tracker App", version="2.0.0")

async def call_open_meteo(client: httpx.AsyncClient, url: str, params: dict):
    active_params = params.copy()
    if WEATHER_PRIMARY_KEY:
        active_params["apikey"] = WEATHER_PRIMARY_KEY

    response = await client.get(url, params=active_params)
    if response.status_code == 429 and WEATHER_BACKUP_KEY:
        active_params["apikey"] = WEATHER_BACKUP_KEY
        response = await client.get(url, params=active_params)

    response.raise_for_status()
    return response.json()

async def find_city(city:str):
    headers = {
        "User-Agent": "WeatherTrackerApp/1.0 (contact@example.com)"
    }
    timeout = httpx.Timeout(15.0, connect=10.0)

    async with httpx.AsyncClient(timeout=10.0, headers=headers, follow_redirects=True) as client:
        try: 
            response = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": city, "count": 1, "language": "en", "format":"json"}
                )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            print(f"[Geocoding HHTP Status Error] Code: {exc.response.status_code}, Response: {exc.response.text}")
            raise HTTPException(status_code=502, detail="Geocoding service returned status {exc.response.status_code}")
        except httpx.HTTPError as exc: 
            print(f"[Geocoding Network Error] {type(exc).__name__}: {exc}")
            raise HTTPException(
                status_code=502,
                detail=f"Geocoding connection failed: {type(exc).__name__}"
            )

        locations = response.json().get("results", [])
        if not locations: 
            raise HTTPException(status_code=404, detail=f"city '{city}' not found")
        return locations[0]

async def fetch_city_photo(
    client: httpx.AsyncClient, 
    city: str, 
    country: str | None = None, 
    season: str | None = None
) -> dict:
    if not UNSPLASH_ACCESS_KEY:
        print("[Unsplash Warning]: UNSPLASH_ACCESS_KEY missing")
        return {"image_url": None, "thumbnail_url": None, "photographer": None}

    search_query = f"{city} landmark".strip()
    headers = {
        "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}",
        "Accept-Version": "v1",
    }
    params = {
        "query": search_query,
        "orientation": "landscape",
        "per_page": 1,
    }

    try:
        res = await client.get("https://api.unsplash.com/search/photos", params=params, headers=headers, timeout=6.0)
        if res.status_code == 200:
            results = res.json().get("results", [])
            if results:
                photo = results[0]
                return {
                    "image_url": photo["urls"]["regular"],
                    "thumbnail_url": photo["urls"]["thumb"],
                    "blur_hash": photo.get("blur_hash"),
                    "description": photo.get("description") or photo.get("alt_description"),
                    "photographer": photo["user"]["name"],
                    "photographer_profile": photo["user"]["links"]["html"],
                }
    except Exception as exc:
        print(f"❌ [Photo fetch exception for {city}]: {exc}")

    # Generic scenic placeholder only if Unsplash returns no results or rate-limits
    default_url = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80"
    return {
        "image_url": default_url,
        "thumbnail_url": default_url,
        "photographer": "Unsplash Curated",
    }

def save_weather_reading(city:str, country:str | None, current:dict, aqi:int | None, season:str):
    with sqlite3.connect(DATABASE) as connection:
        connection.execute(
            """
            INSERT INTO weather_readings (
            city, country, temperature, humidity, wind_speed, uv_index, air_quality_index, weather_code, season, recorded_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (
                city,
                country,
                current.get("temperature_2m"),
                current.get("relative_humidity_2m"),
                current.get("wind_speed_10m"),
                current.get("uv_index"),
                aqi,
                current.get("weather_code"),
                season,
                datetime.now(timezone.utc).isoformat(),
            ),
        )

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    city_context: Optional[dict] = None

@app.post("/chat")
async def chat_with_ollama(payload: ChatRequest):
    last_user_message = payload.messages[-1].content if payload.messages else ""
    active_context = payload.city_context or {}

    # Extract city name (handles "in Tokyo", "in Tokyo, Japan", "for Shibuya right now?", etc.)
    city_match = re.search(
        r'(?:in|for|at)\s+([A-Za-z\s]+?)(?:,\s*[A-Za-z\s]+)?(?:\s+right now|\s+today|\?|$)',
        last_user_message,
        re.IGNORECASE
    )

    if city_match:
        queried_city = city_match.group(1).strip()
        cleaned_city = re.sub(r'(?i)\b(right now|today|tomorrow)\b', '', queried_city).strip()
        
        # If city is valid and different from current context, fetch its live weather
        if cleaned_city and cleaned_city.lower() != active_context.get("city", "").lower():
            try:
                print(f"[SkyBot Tool] Fetching live weather for: {cleaned_city}")
                fetched = await get_weather(cleaned_city)
                if fetched and "current" in fetched:
                    active_context = {
                        "city": fetched["location"]["city"],
                        "country": fetched["location"].get("country", ""),
                        "temperature": fetched["current"]["temperature_2m"],
                        "weather_code": fetched["current"]["weather_code"],
                        "wind_speed": fetched["current"]["wind_speed_10m"],
                        "humidity": fetched["current"].get("relative_humidity_2m"),
                    }
                    print(f"[SkyBot Tool] Attached live weather: {active_context}")
            except Exception as e:
                print(f"[SkyBot Tool] Dynamic fetch error for '{cleaned_city}': {e}")

    # Clean system prompt without syntax breaks
    system_prompt = (
        "You are SkyBot, the in-app weather and travel assistant. "
        "When LIVE WEATHER DATA is provided below, treat it as your own real-time data and answer naturally. "
        "Never say 'according to the provided data' or 'I don't have live data'. "
        "Directly state the current weather, temperature, and conditions in 1 to 2 clear sentences. "
        "Only state that live data is unavailable if no LIVE WEATHER DATA is provided."
    )

    if active_context:
        system_prompt += f"\nLIVE WEATHER DATA:\n{json.dumps(active_context, indent=2)}\n"

    ollama_messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages:
        ollama_messages.append({"role": msg.role, "content": msg.content})

    try:
        client = ollama.AsyncClient()
        response = await client.chat(
            model="llama3.2",
            messages=ollama_messages,
            options={"temperature": 0.2}
        )
        reply_content = response["message"]["content"].strip()
        if not reply_content:
            reply_content = "I could not retrieve the weather details at this moment."
        return {"reply": reply_content}

    except Exception as e:
        print(f"[OLLAMA ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/weather/{city}")
async def get_weather(city: str):
    location = await find_city(city)
    lat, lon = location["latitude"], location["longitude"]
    season = get_season(lat)

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            forecast_data = await call_open_meteo(
                client,
                "https://api.open-meteo.com/v1/forecast",
                {
                    "latitude": lat,
                    "longitude": lon,
                    "current": (
                        "temperature_2m",
                        "relative_humidity_2m",
                        "apparent_temperature",
                        "precipitation",
                        "weather_code",
                        "wind_speed_10m",
                        "uv_index",
                        "is_day",
                    ),
                    "hourly": (
                        "temperature_2m", 
                        "precipitation_probability",
                        "weather_code",
                        "wind_speed_10m",
                        "cloud_cover",
                    ),
                    "daily" : (
                        "weather_code",
                        "temperature_2m_max",
                        "temperature_2m_min",
                        "precipitation_probability_max",
                        "uv_index_max",
                        "sunrise",
                        "sunset"
                    ),
                    "forecast_days": 7,
                    "timezone": "auto",
                }
            )

            aqi_data = await call_open_meteo(
                client,
                "https://air-quality-api.open-meteo.com/v1/air-quality",
                {
                    "latitude":lat,
                    "longitude":lon,
                    "current": "us_aqi,pm10,pm2_5",
                    "timezone": "auto",
                }
            )

            photo_data = await fetch_city_photo(client, location["name"], location.get("country"), season=season)

        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail='Upstream service failure')

    current_weather = forecast_data.get('current', {})
    current_aqi = aqi_data.get('current', {}).get("us_aqi")

    save_weather_reading(
        city=location['name'],
        country=location.get("country"),
        current=current_weather,
        aqi=current_aqi,
        season=season
    )

    return {
        "location": {
            "city": location['name'],
            "region": location.get('admin1'),
            "country" : location.get("country"),
            "latitude": lat,
            "longitude": lon,
            "season": season,
            "photo": photo_data,
        },
        "current": {
            **current_weather,
            "air_quality": aqi_data.get("current")
        },
        "hourly": forecast_data.get("hourly"),
        "seven_day_forecast": forecast_data.get("daily"),
        "units": {
            **forecast_data.get("daily_units", {}),
            "us_aqi": "AQI index (0-500)"
        }
    }

@app.get("/favorites")
def get_favorite_cities():
    return {"favorites": list(FAVORITE.values())}

@app.post("/favorites/{city}")
async def add_favorite_city(city: str):
    data = await find_city(city)
    favorite_key = data["name"].strip().casefold()
    
    if favorite_key in FAVORITE:
        raise HTTPException(
            status_code=400, 
            detail=f"City '{data['name']}' already saved."
        )
        
    FAVORITE[favorite_key] = data
    save_favorite(FAVORITE)
    return {"message": f"City '{data['name']}' added to favorites", "city": data}