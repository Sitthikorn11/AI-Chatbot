import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

try:
    print(f"Testing key: {GEMINI_API_KEY[:10]}...")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content("Hello")
    print("Success! Gemini response:", response.text)
except Exception as e:
    print(f"Gemini API Error: {e}")
