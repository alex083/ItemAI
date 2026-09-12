DEFAULT_PRODUCT_PROMPT = """
You write product listing content for an online store.
Be concise, factual, and useful.
Do not invent certifications, materials, or specs that were not provided.
Pick the closest Google product taxonomy category for the product.
Also produce short SEO fields, bullet points, tags, and a product_type.
""".strip()

GENERATE_JSON_INSTRUCTION = """
Reply with JSON only, no markdown, no extra text:
{
  "description": "string",
  "short_description": "string",
  "meta_title": "string",
  "meta_description": "string",
  "bullet_points": ["string", "string", "string"],
  "tags": ["string", "string"],
  "product_type": "string",
  "google_product_category_id": 212,
  "google_product_category_path": "string"
}
Rules:
- description: full product description for the listing page.
- short_description: 1-2 sentences, under 300 characters.
- meta_title: under 60 characters, include the main product name.
- meta_description: under 160 characters, useful for search snippets.
- bullet_points: 3-5 short concrete benefits, no invented specs.
- tags: 3-8 lowercase keywords/phrases for store search/filtering.
- product_type: short store category label (e.g. "Sneakers", "Rain Jackets").
- google_product_category_id must be a numeric Google product taxonomy id.
- google_product_category_path must be the human-readable taxonomy path.
""".strip()

DEFAULT_PROMPT_TEMPLATES = [
    {
        "slug": "marketplace",
        "title": "Marketplace",
        "body": """
Write product listing content for a marketplace listing.
Use the product title and Google product category.
Cover: what it is, who it is for, key benefits, and practical details.
Also fill short_description, meta_title, meta_description, bullet_points, tags, and product_type.
Keep it clear and scannable. Do not invent specs that were not provided.
""".strip(),
    },
    {
        "slug": "short",
        "title": "Short",
        "body": """
Write short product listing content.
Use the product title and Google product category.
Description: 400-700 characters. One opening sentence, then concrete benefits.
Also fill short_description, meta_title, meta_description, bullet_points, tags, and product_type.
No fluff, no invented specs.
""".strip(),
    },
    {
        "slug": "seo",
        "title": "SEO",
        "body": """
Write SEO-friendly product listing content.
Naturally include the product title and Google product category.
Lead with the main keyword, then benefits, then usage.
Also fill short_description, meta_title, meta_description, bullet_points, tags, and product_type.
Avoid keyword stuffing. Do not invent specs that were not provided.
""".strip(),
    },
    {
        "slug": "premium",
        "title": "Premium",
        "body": """
Write premium brand-style product listing content.
Tone: confident, elegant, specific.
Use the product title and Google product category.
Focus on materials, craft, and how it feels to use.
Also fill short_description, meta_title, meta_description, bullet_points, tags, and product_type.
Do not invent luxury claims or specs that were not provided.
""".strip(),
    },
]
