from langchain.chat_models import init_chat_model

leader_agent = init_chat_model(
  model = "llama3.1",
  model_provider = "ollama",
  temperature = 0.3,
)

