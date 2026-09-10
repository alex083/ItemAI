from django.db import migrations


def seed_prompt_templates(apps, _schema_editor):
    PromptTemplate = apps.get_model("api", "PromptTemplate")
    templates = [
        {
            "slug": "marketplace",
            "title": "Marketplace",
            "body": (
                "Write a product description for a marketplace listing.\n"
                "Use the product title and Google product category.\n"
                "Cover: what it is, who it is for, key benefits, and practical details.\n"
                "Keep it clear and scannable. Do not invent specs that were not provided."
            ),
        },
        {
            "slug": "short",
            "title": "Short",
            "body": (
                "Write a short product description (400-700 characters).\n"
                "Use the product title and Google product category.\n"
                "One opening sentence, then 3-5 concrete benefits.\n"
                "No fluff, no invented specs."
            ),
        },
        {
            "slug": "seo",
            "title": "SEO",
            "body": (
                "Write an SEO-friendly product description.\n"
                "Naturally include the product title and Google product category.\n"
                "Lead with the main keyword, then benefits, then usage.\n"
                "Avoid keyword stuffing. Do not invent specs that were not provided."
            ),
        },
        {
            "slug": "premium",
            "title": "Premium",
            "body": (
                "Write a premium brand-style product description.\n"
                "Tone: confident, elegant, specific.\n"
                "Use the product title and Google product category.\n"
                "Focus on materials, craft, and how it feels to use.\n"
                "Do not invent luxury claims or specs that were not provided."
            ),
        },
    ]
    for item in templates:
        PromptTemplate.objects.update_or_create(slug=item["slug"], defaults=item)


def unseed_prompt_templates(apps, _schema_editor):
    PromptTemplate = apps.get_model("api", "PromptTemplate")
    PromptTemplate.objects.filter(slug__in=["marketplace", "short", "seo", "premium"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_prompt_templates, unseed_prompt_templates),
    ]
