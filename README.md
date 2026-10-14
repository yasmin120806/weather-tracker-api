# Weather Tracker App 🌦️

A modern, full-stack weather and travel companion app built with **React Native (Expo)** and **FastAPI**. It combines hyper-local real-time meteorological forecasts, seasonal travel curations, astronomy visibility scores, ambient audio scapes, Unsplash city imagery, and an AI-powered travel assistant powered by **Ollama**.

---

## 🌟 Key Features

* **Live Weather & Multi-Hour Forecasts**: Real-time conditions, wind speed, UV index, humidity, and dynamic hourly forecast tracks via Open-Meteo API.
* **Air Quality Monitoring**: Real-time air quality metrics displaying US AQI, PM2.5, and PM10 levels with status badging.
* **Seasonal Destinations**: Filter travel destinations by season (Spring, Summer, Autumn, Winter) with automatic hemisphere-aware seasonal detection.
* **Unsplash Visuals**: Dynamic city and landmark skyline photo integration with fallback support.
* **Stargazing Index**: Custom visibility scoring algorithm factoring in cloud cover, precipitation codes, and relative humidity.
* **Dynamic Audio Scapes**: Ambient background soundscapes (gentle rain, night crickets, forest breeze) matching the current location's live weather.
* **Favorites & Local Storage**: Save favorite cities and persist search history locally and on the backend SQLite database.
* **AI Travel Assistant (SkyBot)**: Natural language travel recommendations, packing advice, and weather assistance powered by local LLMs via Ollama.

---

## 🛠️ Tech Stack

### Frontend (Mobile App)
* **Framework**: React Native with [Expo](https://expo.dev/) (Expo Router, Expo Audio/Video)
* **UI Components & Styling**: Gluestack UI, NativeWind / Tailwind CSS, Lucide React Native Icons
* **Language**: TypeScript

### Backend (API Service)
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
* **Server**: Uvicorn
* **Database**: SQLite3 (Historical weather readings & local storage)
* **HTTP Client**: HTTPX (Asynchronous fetching)
* **AI Engine**: Ollama (Local LLM inference)
* **External APIs**: Open-Meteo API (Forecasts & Geocoding), Unsplash Developer API (City photography)

---

## 📁 Project Structure

```text
weather-tracker/
├── backend/
│   ├── main.py                 # FastAPI server, endpoints, and external API connectors
│   ├── weather.db              # SQLite database for logged weather observations
│   ├── favorite_cities.txt     # Serialized favorite locations storage
│   ├── requirements.txt        # Python backend dependencies
│   └── .env                    # Secret keys and API tokens
│
└── frontend/
    ├── app/
    │   ├── _layout.tsx         # Root application layout and navigation
    │   ├── index.tsx           # Main dashboard (Greeting, weather card, seasonal tabs)
    │   ├── history.tsx         # Search history view
    │   ├── chat.tsx            # SkyBot AI assistant screen
    │   └── location/[city].tsx # Detailed city analytics (Air quality, stargazing, audio)
    ├── components/ui/          # Gluestack UI design system components
    ├── lib/
    │   ├── weather-api.ts      # API client for backend communication
    │   └── local-db.ts         # Device-level caching and database helpers
    ├── app.json                # Expo project configuration
    └── package.json
