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


def _as_str(value, *, max_len: int | None = None) -> str:
    text = str(value or "").strip()
    if max_len is not None:
        return text[:max_len]
    return text


def _as_bullet_points(value) -> list[str]:
    if isinstance(value, str):
        parts = re.split(r"[\n|;]+", value)
        items = [part.strip(" •-\t") for part in parts]
    elif isinstance(value, list):
        items = [_as_str(item) for item in value]
    else:
        items = []
    cleaned = [item for item in items if item]
    return cleaned[:8]


def _as_tags(value) -> str:
    if isinstance(value, list):
        parts = [_as_str(item) for item in value]
    elif isinstance(value, str):
        parts = [part.strip() for part in re.split(r"[,;|]+", value)]
    else:
        parts = []
    tags = [part for part in parts if part]
    return ", ".join(dict.fromkeys(tags))[:500]


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

    description = _as_str(data.get("description"))
    category_id = data.get("google_product_category_id")
    if not description:
        raise DeepSeekError("API response is missing description")
    if category_id is None or str(category_id).strip() == "":
        raise DeepSeekError("API response is missing google_product_category_id")

    return {
        "description": description,
        "short_description": _as_str(data.get("short_description"), max_len=2000),
        "meta_title": _as_str(data.get("meta_title"), max_len=200),
        "meta_description": _as_str(data.get("meta_description"), max_len=320),
        "bullet_points": _as_bullet_points(data.get("bullet_points")),
        "tags": _as_tags(data.get("tags")),
        "product_type": _as_str(data.get("product_type"), max_len=200),
        "google_product_category": str(category_id).strip(),
        "google_product_category_path": _as_str(data.get("google_product_category_path"), max_len=500),
    }
