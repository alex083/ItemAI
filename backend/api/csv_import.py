from __future__ import annotations

import csv
import io

MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5_000
CHAR_LIMITS = {
    "title": 200,
    "google_product_category": 200,
    "external_id": 200,
    "barcode": 200,
    "group_id": 200,
}

HEADER_ALIASES: dict[str, set[str]] = {
    "title": {"title", "name", "product_name", "product_title", "назва", "название", "товар"},
    "description": {"description", "desc", "опис", "описание"},
    "google_product_category": {
        "google_product_category",
        "google_category",
        "category",
        "категорія",
        "категория",
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


def parse_product_csv(data: bytes) -> tuple[list[dict[str, str]], list[dict[str, object]]]:
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

    products: list[dict[str, str]] = []
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
                "google_product_category": row.get("google_product_category", ""),
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
    "description",
    "google_product_category",
)


def build_product_csv(products) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_FIELDS, lineterminator="\n")
    writer.writeheader()
    for product in products:
        writer.writerow({field: getattr(product, field, "") or "" for field in EXPORT_FIELDS})
    # UTF-8 BOM so Excel opens Ukrainian/Latin characters correctly
    return ("\ufeff" + buffer.getvalue()).encode("utf-8")
