import os
import json
import pathlib
import google.generativeai as genai
from dotenv import load_dotenv

# Reliably locate .env regardless of where uvicorn is launched from
env_path = pathlib.Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-flash-latest")

def _clean_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json\n", "", 1)
    return json.loads(text)


def suggest_coordinator(subject_name: str, faculty_list: list[dict]) -> list[dict]:
    prompt = f"""
    Here are faculty members eligible to coordinate {subject_name}:
    {json.dumps(faculty_list, indent=2)}
    Rank the top 3 by suitability as Chief Course Coordinator, considering
    designation, current workload, and experience. Respond ONLY with valid JSON:
    [{{"rank": 1, "faculty_name": "...", "reasoning": "..."}}]
    """
    response = model.generate_content(prompt)
    return _clean_json(response.text)


def identify_core_subjects(subject_names: list[str]) -> list[str]:
    prompt = f"""
    From this list of subjects, return ONLY the ones that are 'core/heavy'
    subjects needing high focus (e.g. Mathematics, DBMS, Data Structures,
    Algorithms, Networks, Operating Systems, Compiler Design, Physics,
    Digital Electronics). Respond ONLY with a JSON array of subject names.
    Subjects: {json.dumps(subject_names)}
    """
    response = model.generate_content(prompt)
    return _clean_json(response.text)


def generate_ai_insights(stats_dict: dict) -> str:
    prompt = f"""
    Here are today's academic stats: {json.dumps(stats_dict)}
    Write a 2-3 sentence plain-English summary an admin would find useful.
    """
    response = model.generate_content(prompt)
    return response.text.strip()
def suggest_coordinators_batch(subjects_with_faculty: list[dict]) -> dict:
    """
    subjects_with_faculty: [{"subject_id": 1, "subject_name": "...", "faculty": [{"name":..., "designation":..., "subjects":...}]}]
    Returns: {"1": [{"rank":1,"faculty_name":"...","reasoning":"..."}], ...}
    """
    prompt = f"""
    You are ranking Chief Course Coordinators for multiple subjects at once.
    For EACH subject below, rank the top 3 eligible faculty by suitability
    (considering designation, workload, experience).

    Data:
    {json.dumps(subjects_with_faculty, indent=2)}

    Respond ONLY with valid JSON in this exact shape (keys are subject_id as strings):
    {{
      "1": [{{"rank": 1, "faculty_name": "...", "reasoning": "..."}}],
      "2": [{{"rank": 1, "faculty_name": "...", "reasoning": "..."}}]
    }}
    """
    response = model.generate_content(prompt)
    return _clean_json(response.text)