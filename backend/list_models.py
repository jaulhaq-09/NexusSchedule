import os, pathlib
import google.generativeai as genai
from dotenv import load_dotenv
env_path = pathlib.Path('app') / '.env'
load_dotenv(dotenv_path=env_path)
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
