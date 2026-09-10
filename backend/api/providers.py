import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class ProviderError(Exception):
    pass


def fetch_available_models(*, api_url: str, api_key: str = "") -> list[dict]:
    parsed = urlparse(api_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ProviderError("Invalid API URL")

    url = f"{api_url.rstrip('/')}/models"
    request = Request(url, method="GET")
    request.add_header("Accept", "application/json")
    if api_key:
        request.add_header("Authorization", f"Bearer {api_key}")

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ProviderError(f"Could not load models: HTTP {exc.code}") from exc
    except URLError as exc:
        raise ProviderError("Could not reach the models API") from exc
    except json.JSONDecodeError as exc:
        raise ProviderError("Models API did not return valid JSON") from exc

    raw_items = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(raw_items, list):
        raise ProviderError("Models API returned an unexpected format")

    models: list[dict] = []
    seen: set[str] = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        model_id = str(item.get("id") or "").strip()
        if not model_id or model_id in seen:
            continue
        seen.add(model_id)
        models.append({"id": model_id, "name": str(item.get("name") or model_id).strip()})
    models.sort(key=lambda item: item["name"].lower())
    return models
