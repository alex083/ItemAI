from __future__ import annotations

import csv
import io
import json
import re

MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5_000
CHAR_LIMITS = {
    "title": 200,
    "google_product_category": 200,
    "google_product_category_path": 500,
    "external_id": 200,
    "barcode": 200,
    "group_id": 200,
    "meta_title": 200,
    "meta_description": 320,
    "tags": 500,
    "product_type": 200,
}

HEADER_ALIASES: dict[str, set[str]] = {
    "title": {"title", "name", "product_name", "product_title", "назва", "название", "товар"},
    "description": {"description", "desc", "опис", "описание"},
    "short_description": {"short_description", "short_desc", "summary", "короткий_опис"},
    "meta_title": {"meta_title", "seo_title", "page_title"},
    "meta_description": {"meta_description", "seo_description", "meta_desc"},
    "bullet_points": {"bullet_points", "bullets", "features", "переваги"},
    "tags": {"tags", "tag", "keywords", "теги"},
    "product_type": {"product_type", "type", "store_category", "тип"},
    "google_product_category": {
        "google_product_category",
        "google_category",
        "category",
        "категорія",
        "категория",
    },
    "google_product_category_path": {
        "google_product_category_path",
        "google_category_path",
        "category_path",
    },
    "external_id": {
        "external_id",
        "store_id",
        "sku",
        "id",
        "product_id",
        "артикул",
    },
    "barcode": {"barcode", "ean", "gtin", "upc", "штрихкод"},
    "group_id": {"group_id", "group", "item_group_id", "item_group"},
}


class CsvImportError(ValueError):
    pass


def _normalize_header(value: str) -> str:
    return "_".join(value.strip().lower().replace("-", " ").split())


def _header_to_field(header: str) -> str | None:
    normalized = _normalize_header(header)
    for field, aliases in HEADER_ALIASES.items():
        if normalized in aliases:
            return field
    return None


def decode_csv_bytes(data: bytes) -> str:
    if not data:
        raise CsvImportError("The CSV file is empty.")
    if len(data) > MAX_CSV_BYTES:
        raise CsvImportError("CSV is too large (max 5 MB).")
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        return data.decode("utf-16")
    if data.startswith(b"\xef\xbb\xbf"):
        return data.decode("utf-8-sig")
    for encoding in ("utf-8", "cp1251"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise CsvImportError("Could not decode CSV. Save the file as UTF-8 and try again.")


def _detect_delimiter(text: str) -> str:
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    counts = {",": first_line.count(","), ";": first_line.count(";"), "\t": first_line.count("\t")}
    best = max(counts, key=counts.get)
    return best if counts[best] else ","


def _parse_bullet_points(value: str) -> list[str]:
    text = (value or "").strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            raw = json.loads(text)
            if isinstance(raw, list):
                return [str(item).strip() for item in raw if str(item).strip()][:8]
        except json.JSONDecodeError:
            pass
    parts = re.split(r"[\n|;]+", text)
    return [part.strip(" •-\t") for part in parts if part.strip(" •-\t")][:8]


def parse_product_csv(data: bytes) -> tuple[list[dict], list[dict[str, object]]]:
    text = decode_csv_bytes(data)
    reader = csv.DictReader(io.StringIO(text), delimiter=_detect_delimiter(text))
    if not reader.fieldnames:
        raise CsvImportError("CSV has no header row.")

    header_map: dict[str, str] = {}
    for raw in reader.fieldnames:
        if raw is None:
            continue
        field = _header_to_field(raw)
        if field and field not in header_map.values():
            header_map[raw] = field

    if "title" not in header_map.values():
        raise CsvImportError("CSV must include a title (or name) column.")

    products: list[dict] = []
    errors: list[dict[str, object]] = []

    for data_row_number, raw_row in enumerate(reader, start=1):
        if data_row_number > MAX_ROWS:
            raise CsvImportError(f"CSV has too many rows (max {MAX_ROWS}).")

        line_number = data_row_number + 1
        values = [value for value in raw_row.values() if value is not None]
        if not any(value.strip() for value in values):
            continue

        row: dict[str, str] = {}
        for csv_header, field in header_map.items():
            value = (raw_row.get(csv_header) or "").strip()
            limit = CHAR_LIMITS.get(field)
            if limit:
                value = value[:limit]
            row[field] = value

        title = row.get("title", "").strip()
        if not title:
            errors.append({"row": line_number, "detail": "Missing title"})
            continue

        products.append(
            {
                "title": title,
                "description": row.get("description", ""),
                "short_description": row.get("short_description", ""),
                "meta_title": row.get("meta_title", ""),
                "meta_description": row.get("meta_description", ""),
                "bullet_points": _parse_bullet_points(row.get("bullet_points", "")),
                "tags": row.get("tags", ""),
                "product_type": row.get("product_type", ""),
                "google_product_category": row.get("google_product_category", ""),
                "google_product_category_path": row.get("google_product_category_path", ""),
                "external_id": row.get("external_id", ""),
                "barcode": row.get("barcode", ""),
                "group_id": row.get("group_id", ""),
            }
        )

    return products, errors


EXPORT_FIELDS = (
    "title",
    "external_id",
    "barcode",
    "group_id",
    "product_type",
    "tags",
    "short_description",
    "description",
    "meta_title",
    "meta_description",
    "bullet_points",
    "google_product_category",
    "google_product_category_path",
)


def _export_value(product, field: str) -> str:
    value = getattr(product, field, "")
    if field == "bullet_points":
        if isinstance(value, list):
            return " | ".join(str(item) for item in value if str(item).strip())
        return str(value or "")
    return "" if value is None else str(value)


def build_product_csv(products) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_FIELDS, lineterminator="\n")
    writer.writeheader()
    for product in products:
        writer.writerow({field: _export_value(product, field) for field in EXPORT_FIELDS})
    # UTF-8 BOM so Excel opens Ukrainian/Latin characters correctly
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")
