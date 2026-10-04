import base64
import os
from pathlib import Path

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from google import genai

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "Frontend"

app = Flask(__name__)
CORS(app)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MURF_API_KEY = os.getenv("MURF_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

SUPPORTED_ANSWER_TYPES = {"Summary", "Detailed"}
SUPPORTED_LANGUAGES = {"English", "Hindi", "Tamil", "Telugu"}

PROMPTS = {
    "Summary": """
You are a professional tourist guide. Give an engaging high-level overview of
"{place}" in {language}. Cover why it is famous, its historical significance,
and its main cultural or architectural highlight. Keep it around 180 words.
Respond only in {language}.
""",
    "Detailed": """
You are a professional tourist guide. Give an immersive guide to "{place}" in
{language}. Cover historical background, architecture, cultural importance,
interesting facts, and useful visitor context. Keep it around 350 words.
Respond only in {language}.
""",
}

FALLBACK_DESCRIPTIONS = {
    "Taj Mahal": "The Taj Mahal is one of India's most iconic monuments, built by Emperor Shah Jahan in memory of Mumtaz Mahal. It is a masterpiece of Mughal architecture, combining Persian, Indian, and Islamic design. Its white marble changes character with the daylight, making sunrise and sunset especially memorable.",
    "Red Fort": "The Red Fort in Delhi was the political and ceremonial heart of the Mughal Empire. Its immense red-sandstone walls surround graceful halls, gardens, and gateways that show the grandeur of Mughal design. It remains one of India's most important historic landmarks.",
    "Gateway of India": "The Gateway of India overlooks Mumbai's busy harbour and has become a lasting symbol of the city. Built in the early twentieth century in an Indo-Saracenic style, it brings together Indian and European architectural influences in a welcoming waterfront monument.",
    "Hawa Mahal": "Hawa Mahal, the Palace of Winds, is Jaipur's striking honeycomb-like facade of red and pink sandstone. Its many small windows were designed to let royal women observe city life discreetly while cool air circulated through the palace.",
    "Golden Temple": "The Golden Temple in Amritsar is the holiest Gurdwara in Sikhism and a place of profound calm. Its golden sanctuary, reflective pool, and community kitchen express Sikh values of equality, humility, service, and welcome.",
    "Mysore Palace": "Mysore Palace is a magnificent royal residence celebrated for its domes, arches, stained glass, and richly decorated interiors. It reflects the legacy of the Wadiyar dynasty and is particularly spectacular when illuminated after dark.",
}


def fallback_description(place: str, answer_type: str) -> str:
    text = FALLBACK_DESCRIPTIONS.get(
        place,
        f"{place} is a significant cultural and historic destination in India, known for its heritage, architecture, and local traditions.",
    )
    if answer_type == "Detailed":
        text += " Its story connects artistic achievement with the people and traditions that have shaped the region over generations. Take time to notice the craftsmanship, the setting, and the small details that make the site distinctive."
    return text


def generate_description(place: str, answer_type: str, language: str) -> str:
    if not client:
        return fallback_description(place, answer_type)

    try:
        prompt = PROMPTS[answer_type].format(place=place, language=language)
        response = client.models.generate_content(model="gemini-2.0-flash-lite", contents=prompt)
        if response.text and response.text.strip():
            return response.text.strip()
    except Exception:
        app.logger.exception("Gemini description generation failed; using local description.")

    return fallback_description(place, answer_type)


def generate_speech(text: str, voice_id: str, locale: str) -> bytes | None:
    """Return MP3 data when Murf is configured; otherwise let the UI use transcript mode."""
    if not MURF_API_KEY:
        return None

    response = requests.post(
        "https://global.api.murf.ai/v1/speech/stream",
        headers={"api-key": MURF_API_KEY, "Content-Type": "application/json"},
        json={
            "voice_id": voice_id,
            "text": text,
            "locale": locale,
            "model": "FALCON",
            "format": "MP3",
            "sampleRate": 24000,
            "channelType": "MONO",
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.content


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/assets/<path:filename>")
def frontend_static(filename: str):
    return send_from_directory(FRONTEND_DIR, filename)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "audioConfigured": bool(MURF_API_KEY)})


@app.post("/generate-audio-guide")
def generate_audio_guide():
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON."}), 400

    data = request.get_json(silent=True) or {}
    place = str(data.get("place", "")).strip()
    answer_type = data.get("answerType")
    language = data.get("language")
    voice_id = str(data.get("voiceId", "")).strip()
    locale = str(data.get("locale", "")).strip()

    if not all((place, answer_type, language, voice_id, locale)):
        return jsonify({"error": "Choose a destination, guide length, language, and voice."}), 400
    if answer_type not in SUPPORTED_ANSWER_TYPES or language not in SUPPORTED_LANGUAGES:
        return jsonify({"error": "Unsupported guide length or language."}), 400
    if len(place) > 100 or len(voice_id) > 100 or len(locale) > 25:
        return jsonify({"error": "One or more values are too long."}), 400

    text_description = generate_description(place, answer_type, language)
    audio_bytes = None
    audio_error = False
    try:
        audio_bytes = generate_speech(text_description, voice_id, locale)
    except requests.RequestException:
        audio_error = True
        app.logger.exception("Murf speech generation failed; returning transcript.")

    return jsonify(
        {
            "description": text_description,
            "audioBase64": base64.b64encode(audio_bytes).decode("utf-8") if audio_bytes else "",
            "audioAvailable": bool(audio_bytes),
            "audioError": audio_error,
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
