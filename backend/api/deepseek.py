import json
import re

from openai import OpenAI

from .prompts import GENERATE_JSON_INSTRUCTION

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-flash"


class DeepSeekError(Exception):
    pass


def _parse_json(raw: str) -> dict:
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fenced:
        text = fenced.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DeepSeekError("The API did not return valid JSON") from exc
    if not isinstance(data, dict):
        raise DeepSeekError("API JSON must be an object")
    return data


def generate_product_copy(
    *,
    api_key: str,
    system_prompt: str,
    title: str,
    base_url: str | None = None,
    model: str | None = None,
) -> dict:
    if not api_key.strip():
        raise DeepSeekError("Profile has no API key")

    client = OpenAI(api_key=api_key, base_url=base_url or DEEPSEEK_BASE_URL)
    response = client.chat.completions.create(
        model=model or DEEPSEEK_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"{system_prompt}\n\n{GENERATE_JSON_INSTRUCTION}",
            },
            {
                "role": "user",
                "content": f"Product title: {title}",
            },
        ],
        temperature=0.4,
    )
    content = response.choices[0].message.content or ""
    data = _parse_json(content)

    description = str(data.get("description") or "").strip()
    category_id = data.get("google_product_category_id")
    if not description:
        raise DeepSeekError("API response is missing description")
    if category_id is None or str(category_id).strip() == "":
        raise DeepSeekError("API response is missing google_product_category_id")

    return {
        "description": description,
        "google_product_category": str(category_id).strip(),
        "google_product_category_path": str(
            data.get("google_product_category_path") or ""
        ).strip(),
    }
