import os
from google import genai

api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_GENAI_API_KEY")
client = genai.Client(api_key=api_key, http_options={'api_version': 'v1beta'})

for model in client.models.list():
    print(model.name)
