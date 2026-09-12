"""Image generation for product photos.

Providers:
- OpenAI-compatible `images.generate` / `images.edit` (default)
- Google Gemini native REST (when api_url hosts generativelanguage.googleapis.com)
- OpenRouter dedicated `/images` API, plus chat+modalities for `openrouter/auto*`

When a reference image is provided, providers are asked to keep the product identical
and only improve e-commerce presentation (background, lighting, framing).
"""

from __future__ import annotations

import base64
import io
import json
import re
import urllib.request
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

from openai import OpenAI

IMAGE_BASE_URL = "https://api.openai.com/v1"
DEFAULT_IMAGE_MODEL = "gpt-image-1"
DEFAULT_IMAGE_SIZE = "1024x1024"
GEMINI_HOST = "generativelanguage.googleapis.com"
OPENROUTER_HOST = "openrouter.ai"
# Auto router often picks text models; pin image generation to a known image-output slug.
OPENROUTER_DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image"
DATA_URL_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL)

REFERENCE_INSTRUCTION = (
    "Use the attached reference photo as the ground truth for the product. "
    "Keep the product identical: shape, proportions, colors, materials, labels, and details. "
    "Do not invent a different product. Only improve presentation for e-commerce: "
    "clean neutral/studio background, professional lighting, centered composition, "
    "high detail, no text overlays, no watermark."
)


class ImageGenerationError(Exception):
    pass


def build_product_image_prompt(
    *,
    title: str,
    image_prompt: str = "",
    custom_prompt: str = "",
    description: str = "",
    short_description: str = "",
    product_type: str = "",
    tags: str = "",
    has_reference: bool = False,
) -> str:
    """Build the final image prompt from profile template / one-off override / defaults."""
    template = (custom_prompt or image_prompt or "").strip()
    if template:
        prompt = (
            template.replace("{title}", title)
            .replace("{description}", description or "")
            .replace("{short_description}", short_description or "")
            .replace("{product_type}", product_type or "")
            .replace("{tags}", tags or "")
        )
    else:
        prompt = (
            f"Professional e-commerce product photo of: {title}."
            + (f" Product type: {product_type}." if product_type.strip() else "")
            + (f" Details: {short_description or description}." if (short_description or description).strip() else "")
            + (f" Tags: {tags}." if tags.strip() else "")
            + " Clean neutral background, studio lighting, centered composition, high detail, no text, no watermark."
        )

    if has_reference:
        prompt = f"{REFERENCE_INSTRUCTION}\n\n{prompt}"
    return prompt.strip()


def _guess_mime(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    return "image/png"


def _data_url(data: bytes, mime: str | None = None) -> str:
    mime_type = mime or _guess_mime(data)
    return f"data:{mime_type};base64,{base64.b64encode(data).decode('ascii')}"


def _is_openrouter(base_url: str) -> bool:
    return OPENROUTER_HOST in (urlparse(base_url).netloc or base_url)


def _is_auto_router_model(model: str) -> bool:
    normalized = model.strip().lower()
    return normalized in {"openrouter/auto", "openrouter/auto-beta", "auto"} or normalized.endswith("/auto")


def _resolve_openrouter_image_model(model: str) -> str:
    """Map auto/short aliases to a concrete OpenRouter image-output slug."""
    name = model.strip()
    if _is_auto_router_model(name):
        return OPENROUTER_DEFAULT_IMAGE_MODEL

    lower = name.lower().removeprefix("models/")
    aliases = {
        "gemini-flash-image": OPENROUTER_DEFAULT_IMAGE_MODEL,
        "gemini-2.5-flash-image": OPENROUTER_DEFAULT_IMAGE_MODEL,
        "gemini-2.5-flash-image-preview": OPENROUTER_DEFAULT_IMAGE_MODEL,
        "nano-banana": OPENROUTER_DEFAULT_IMAGE_MODEL,
        "google/gemini-flash-image": OPENROUTER_DEFAULT_IMAGE_MODEL,
        "google/gemini-2.5-flash-image-preview": OPENROUTER_DEFAULT_IMAGE_MODEL,
    }
    return aliases.get(lower, name)


def _openrouter_looks_like_image_model(model: str) -> bool:
    m = model.lower()
    markers = ("image", "flux", "seedream", "dall-e", "sdxl", "stable-diffusion", "ideogram", "recraft")
    return any(marker in m for marker in markers)


def _size_to_aspect_ratio(size: str) -> str:
    """Map WxH size strings to OpenRouter aspect_ratio values."""
    raw = (size or "").strip().lower()
    if not raw or "x" not in raw:
        return "1:1"
    try:
        width_s, height_s = raw.split("x", 1)
        width, height = int(width_s), int(height_s)
    except ValueError:
        return "1:1"
    if width <= 0 or height <= 0:
        return "1:1"
    if width == height:
        return "1:1"
    if width > height:
        return "3:2" if width / height < 1.6 else "16:9"
    return "2:3" if height / width < 1.6 else "9:16"


def _bytes_from_data_url_or_b64(value: str) -> bytes | None:
    text = (value or "").strip()
    if not text:
        return None
    match = DATA_URL_RE.match(text)
    if match:
        return base64.b64decode(match.group(2))
    try:
        return base64.b64decode(text, validate=False)
    except Exception:
        return None


def generate_product_image(
    *,
    api_key: str,
    title: str,
    prompt: str = "",
    base_url: str | None = None,
    model: str | None = None,
    size: str = DEFAULT_IMAGE_SIZE,
    reference_image: bytes | None = None,
) -> bytes:
    if not api_key.strip():
        raise ImageGenerationError("Profile has no API key")

    final_prompt = prompt.strip() or build_product_image_prompt(title=title, has_reference=bool(reference_image))
    chosen_model = (model or DEFAULT_IMAGE_MODEL).strip()
    effective_base = (base_url or IMAGE_BASE_URL).strip()

    if GEMINI_HOST in effective_base:
        return _generate_with_gemini(
            api_key=api_key,
            model=chosen_model,
            prompt=final_prompt,
            reference_image=reference_image,
        )

    if _is_openrouter(effective_base):
        return _generate_with_openrouter(
            api_key=api_key,
            base_url=effective_base,
            model=chosen_model,
            prompt=final_prompt,
            size=size,
            reference_image=reference_image,
        )

    return _generate_with_openai_compat(
        api_key=api_key,
        base_url=effective_base,
        model=chosen_model,
        prompt=final_prompt,
        size=size,
        reference_image=reference_image,
    )


def _generate_with_openai_compat(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    size: str,
    reference_image: bytes | None,
) -> bytes:
    client = OpenAI(api_key=api_key, base_url=base_url)
    if reference_image:
        mime = _guess_mime(reference_image)
        ext = "png" if "png" in mime else "webp" if "webp" in mime else "jpg"
        image_file = io.BytesIO(reference_image)
        image_file.name = f"reference.{ext}"
        try:
            response = client.images.edit(
                model=model,
                image=image_file,
                prompt=prompt,
                size=size,
                n=1,
            )
        except Exception:
            # Some OpenAI-compat gateways only support generate; try without edit.
            response = client.images.generate(model=model, prompt=prompt, size=size, n=1)
        return _bytes_from_openai_images_response(response)

    response = client.images.generate(model=model, prompt=prompt, size=size, n=1)
    return _bytes_from_openai_images_response(response)


def _bytes_from_openai_images_response(response) -> bytes:
    if not getattr(response, "data", None):
        raise ImageGenerationError("Image API did not return any image data")

    item = response.data[0]
    b64_data = getattr(item, "b64_json", None)
    if b64_data:
        return base64.b64decode(b64_data)

    url = getattr(item, "url", None)
    if url:
        decoded = _bytes_from_data_url_or_b64(url)
        if decoded:
            return decoded
        with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 - provider-returned HTTPS URL
            return resp.read()

    raise ImageGenerationError("Image API did not return image data")


def _image_entry_to_bytes(entry) -> bytes | None:
    if entry is None:
        return None
    if isinstance(entry, (bytes, bytearray)):
        return bytes(entry)
    if isinstance(entry, str):
        return _bytes_from_data_url_or_b64(entry)
    if not isinstance(entry, dict):
        # Pydantic / SDK objects
        image_url = getattr(entry, "image_url", None)
        url = getattr(image_url, "url", None) if image_url is not None else None
        url = url or getattr(entry, "url", None) or getattr(entry, "b64_json", None) or getattr(entry, "data", None)
        return _bytes_from_data_url_or_b64(str(url or "")) if url else None

    image_url = entry.get("image_url")
    if isinstance(image_url, dict):
        candidate = image_url.get("url")
    else:
        candidate = image_url
    candidate = candidate or entry.get("url") or entry.get("b64_json") or entry.get("data")
    if isinstance(candidate, str):
        return _bytes_from_data_url_or_b64(candidate)
    return None


def _extract_images_from_openrouter_message(message: dict) -> bytes | None:
    for entry in message.get("images") or []:
        decoded = _image_entry_to_bytes(entry)
        if decoded:
            return decoded

    content = message.get("content")
    if isinstance(content, str):
        match = DATA_URL_RE.search(content)
        if match:
            return base64.b64decode(match.group(2))
        # Sometimes models dump raw base64 without data: prefix in a fenced block — skip.
    if isinstance(content, list):
        for part in content:
            if not isinstance(part, dict):
                continue
            part_type = part.get("type")
            if part_type in {"image_url", "output_image", "image"}:
                decoded = _image_entry_to_bytes(part)
                if decoded:
                    return decoded
            # Gemini-style inline through OpenRouter
            inline = part.get("inline_data") or part.get("inlineData")
            if isinstance(inline, dict) and inline.get("data"):
                try:
                    return base64.b64decode(inline["data"])
                except Exception:
                    pass
    return None


def _openrouter_post_json(url: str, api_key: str, payload: dict, *, timeout: int = 120) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://itemai.local",
            "X-Title": "ItemAI",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        message = None
        try:
            parsed = json.loads(detail)
            err = parsed.get("error")
            if isinstance(err, dict):
                message = err.get("message") or err.get("metadata", {}).get("raw")
            elif isinstance(err, str):
                message = err
            message = message or parsed.get("message")
        except (json.JSONDecodeError, AttributeError, TypeError):
            message = detail.strip()[:400] or None
        raise ImageGenerationError(message or f"OpenRouter request failed: HTTP {exc.code}") from exc
    except URLError as exc:
        raise ImageGenerationError("Could not reach OpenRouter") from exc
    except json.JSONDecodeError as exc:
        raise ImageGenerationError("OpenRouter did not return valid JSON") from exc


def _generate_with_openrouter(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    size: str,
    reference_image: bytes | None,
) -> bytes:
    resolved = _resolve_openrouter_image_model(model)
    images_error: str | None = None
    chat_error: str | None = None

    # OpenRouter's dedicated /images API is the canonical path for image models.
    # Chat+modalities is a fallback (Gemini often answers with text analysis there).
    try:
        return _generate_openrouter_images_api(
            api_key=api_key,
            model=resolved,
            prompt=prompt,
            size=size,
            reference_image=reference_image,
        )
    except ImageGenerationError as exc:
        images_error = str(exc)

    try:
        return _generate_openrouter_chat_image(
            api_key=api_key,
            base_url=base_url,
            model=resolved,
            prompt=prompt,
            reference_image=reference_image,
        )
    except ImageGenerationError as exc:
        chat_error = str(exc)

    parts = [p for p in (images_error, chat_error) if p]
    detail = " | ".join(parts) if parts else "unknown error"
    hint = (
        f" Tried model “{resolved}”."
        + (
            f" (mapped from “{model.strip()}”)"
            if model.strip() != resolved
            else ""
        )
    )
    raise ImageGenerationError(
        f"OpenRouter did not return an image ({detail}).{hint} "
        "Use the full slug google/gemini-2.5-flash-image "
        "(or black-forest-labs/flux.2-pro)."
    )


def _generate_openrouter_chat_image(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    reference_image: bytes | None = None,
) -> bytes:
    router_model = _resolve_openrouter_image_model(model)
    if not _openrouter_looks_like_image_model(router_model):
        raise ImageGenerationError(
            f"Model “{router_model}” does not look like an image-output model. "
            f"Use {OPENROUTER_DEFAULT_IMAGE_MODEL} (or another *image* / flux model)."
        )

    image_only_prompt = (
        "Return only a generated image. Do not describe the photo, do not analyze it, "
        "and do not reply with text.\n\n"
        f"{prompt}"
    )
    if reference_image:
        content: list | str = [
            {"type": "text", "text": image_only_prompt},
            {"type": "image_url", "image_url": {"url": _data_url(reference_image)}},
        ]
    else:
        content = image_only_prompt

    chat_url = f"{base_url.rstrip('/')}/chat/completions"
    # Prefer image+text (OpenRouter multimodal default), then image-only.
    modality_attempts = (["image", "text"], ["image"])
    last_text_snippet = ""

    for modalities in modality_attempts:
        data = _openrouter_post_json(
            chat_url,
            api_key,
            {
                "model": router_model,
                "messages": [{"role": "user", "content": content}],
                "modalities": modalities,
            },
        )

        choices = data.get("choices") or []
        if not choices:
            continue

        choice = choices[0] or {}
        message = choice.get("message") or {}
        decoded = _extract_images_from_openrouter_message(message)
        if decoded:
            return decoded

        for entry in choice.get("images") or []:
            decoded = _image_entry_to_bytes(entry)
            if decoded:
                return decoded

        preview = message.get("content")
        if isinstance(preview, str) and preview.strip():
            last_text_snippet = preview.strip().replace("\n", " ")[:160]

    if last_text_snippet:
        raise ImageGenerationError(
            f"OpenRouter/Gemini returned text instead of an image: “{last_text_snippet}”. "
            f"Confirm “{router_model}” supports image output on your OpenRouter account."
        )
    raise ImageGenerationError(
        f"OpenRouter chat response had no image payload for “{router_model}”."
    )


def _generate_openrouter_images_api(
    *,
    api_key: str,
    model: str,
    prompt: str,
    size: str,
    reference_image: bytes | None = None,
) -> bytes:
    router_model = _resolve_openrouter_image_model(model)
    if not _openrouter_looks_like_image_model(router_model):
        raise ImageGenerationError(
            f"Model “{router_model}” does not look like an image-output model. "
            f"Use {OPENROUTER_DEFAULT_IMAGE_MODEL}."
        )

    payload: dict = {
        "model": router_model,
        "prompt": prompt,
        "n": 1,
        # Gemini on OpenRouter accepts aspect_ratio; size WxH is often ignored/rejected.
        "aspect_ratio": _size_to_aspect_ratio(size),
    }
    if reference_image:
        payload["input_references"] = [
            {"type": "image_url", "image_url": {"url": _data_url(reference_image)}}
        ]

    data = _openrouter_post_json("https://openrouter.ai/api/v1/images", api_key, payload)

    err = data.get("error") if isinstance(data, dict) else None
    if isinstance(err, dict) and (err.get("message") or err.get("code")):
        raise ImageGenerationError(str(err.get("message") or err.get("code")))

    items = data.get("data") if isinstance(data, dict) else None
    if not items:
        # Some Gemini bridge failures return 200 with empty data / finish metadata.
        meta = ""
        if isinstance(data, dict):
            for key in ("finish_reason", "finishReason", "status", "message"):
                if data.get(key):
                    meta = f" ({data.get(key)})"
                    break
        raise ImageGenerationError(f"OpenRouter image API returned no image data{meta}")

    first = items[0] if isinstance(items[0], dict) else {}
    b64_data = first.get("b64_json")
    if b64_data:
        return base64.b64decode(b64_data)
    url = first.get("url")
    decoded = _bytes_from_data_url_or_b64(str(url or ""))
    if decoded:
        return decoded
    if url:
        with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310
            return resp.read()
    raise ImageGenerationError("OpenRouter image API did not return image data")

def _normalize_gemini_model(model: str) -> str:
    """Strip OpenRouter/provider prefixes so the slug works with Gemini native API."""
    name = model.strip()
    if name.startswith("models/"):
        name = name[len("models/") :]
    if name.startswith("google/"):
        name = name[len("google/") :]
    aliases = {
        "gemini-flash-image": "gemini-2.5-flash-image",
        "gemini-2.5-flash-image-preview": "gemini-2.5-flash-image",
        "gemini-3-pro-image": "gemini-3-pro-image-preview",
        "gemini-3.1-flash-image": "gemini-3.1-flash-image-preview",
    }
    return aliases.get(name, name)


def _generate_with_gemini(
    *,
    api_key: str,
    model: str,
    prompt: str,
    reference_image: bytes | None = None,
) -> bytes:
    model = _normalize_gemini_model(model)
    if "imagen" in model.lower():
        if reference_image:
            raise ImageGenerationError(
                "Imagen predict does not support reference photos here. "
                "Use a Gemini image model (e.g. gemini-2.5-flash-image) or OpenRouter."
            )
        url = f"https://{GEMINI_HOST}/v1beta/models/{model}:predict"
        payload = {"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1}}
    else:
        url = f"https://{GEMINI_HOST}/v1beta/models/{model}:generateContent"
        parts: list[dict] = [{"text": prompt}]
        if reference_image:
            parts.append(
                {
                    "inlineData": {
                        "mimeType": _guess_mime(reference_image),
                        "data": base64.b64encode(reference_image).decode("ascii"),
                    }
                }
            )
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        message = None
        try:
            err = json.loads(detail).get("error") or {}
            if isinstance(err, dict):
                message = err.get("message")
            elif isinstance(err, str):
                message = err
        except (json.JSONDecodeError, AttributeError, TypeError):
            message = detail.strip()[:300] or None
        if exc.code == 404:
            raise ImageGenerationError(
                message
                or (
                    f"Gemini model “{model}” not found or not available for this API key. "
                    "Image models usually require billing."
                )
            ) from exc
        raise ImageGenerationError(message or f"Gemini image API request failed: HTTP {exc.code}") from exc
    except URLError as exc:
        raise ImageGenerationError("Could not reach the Gemini image API") from exc
    except json.JSONDecodeError as exc:
        raise ImageGenerationError("Gemini image API did not return valid JSON") from exc

    predictions = data.get("predictions")
    if predictions:
        b64_data = predictions[0].get("bytesBase64Encoded")
        if b64_data:
            return base64.b64decode(b64_data)
        raise ImageGenerationError("Gemini did not return image data")

    prompt_feedback = data.get("promptFeedback") or data.get("prompt_feedback") or {}
    block_reason = prompt_feedback.get("blockReason") or prompt_feedback.get("block_reason")
    if block_reason:
        raise ImageGenerationError(f"Gemini blocked the request ({block_reason}). Try a different prompt or model.")

    for candidate in data.get("candidates") or []:
        finish = candidate.get("finishReason") or candidate.get("finish_reason")
        parts = (candidate.get("content") or {}).get("parts") or []
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
        if finish and finish not in {"STOP", "MAX_TOKENS"}:
            raise ImageGenerationError(
                f"Gemini finished without an image ({finish}). "
                "This model may be unavailable for your API key/tier."
            )

    raise ImageGenerationError(
        "Gemini did not return image data. "
        "Image generation usually requires a paid Google AI key."
    )
