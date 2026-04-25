import os

# Mặc định: Ollama trên cùng máy. Trong Docker (Mac/Windows) set OLLAMA_BASE_URL
# tới host, ví dụ: http://host.docker.internal:11434
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
