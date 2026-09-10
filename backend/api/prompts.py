DEFAULT_PRODUCT_PROMPT = """
You write product descriptions for an online store.
Be concise, factual, and useful.
Do not invent certifications, materials, or specs that were not provided.
Pick the closest Google product taxonomy category for the product.
""".strip()

GENERATE_JSON_INSTRUCTION = """
Reply with JSON only, no markdown, no extra text:
{"description": "string", "google_product_category_id": 212, "google_product_category_path": "string"}
google_product_category_id must be a numeric Google product taxonomy id.
""".strip()

DEFAULT_PROMPT_TEMPLATES = [
    {
        "slug": "marketplace",
        "title": "Marketplace",
        "body": """
Write a product description for a marketplace listing.
Use the product title and Google product category.
Cover: what it is, who it is for, key benefits, and practical details.
Keep it clear and scannable. Do not invent specs that were not provided.
""".strip(),
    },
    {
        "slug": "short",
        "title": "Short",
        "body": """
Write a short product description (400-700 characters).
Use the product title and Google product category.
One opening sentence, then 3-5 concrete benefits.
No fluff, no invented specs.
""".strip(),
    },
    {
        "slug": "seo",
        "title": "SEO",
        "body": """
Write an SEO-friendly product description.
Naturally include the product title and Google product category.
Lead with the main keyword, then benefits, then usage.
Avoid keyword stuffing. Do not invent specs that were not provided.
""".strip(),
    },
    {
        "slug": "premium",
        "title": "Premium",
        "body": """
Write a premium brand-style product description.
Tone: confident, elegant, specific.
Use the product title and Google product category.
Focus on materials, craft, and how it feels to use.
Do not invent luxury claims or specs that were not provided.
""".strip(),
    },
]
