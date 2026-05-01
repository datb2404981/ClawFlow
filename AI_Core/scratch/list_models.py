import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GOOGLE_GENAI_API_KEY")
if not api_key:
    print("Missing GOOGLE_GENAI_API_KEY")
    exit(1)

client = genai.Client(api_key=api_key)

try:
    print("Listing models...")
    for model in client.models.list():
        print(f"Name: {model.name}, Supported Methods: {model.supported_variants}")
except Exception as e:
    print(f"Error: {e}")
