import django.db.models.deletion
from django.db import migrations, models


def seed_deepseek(apps, _schema_editor):
    Integration = apps.get_model("api", "Integration")
    Integration.objects.get_or_create(
        name="DeepSeek",
        defaults={
            "api_url": "https://api.deepseek.com",
            "model": "deepseek-flash",
            "is_active": True,
        },
    )


def unseed_deepseek(apps, _schema_editor):
    Integration = apps.get_model("api", "Integration")
    Integration.objects.filter(name="DeepSeek").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0004_profile_user_optional"),
    ]

    operations = [
        migrations.CreateModel(
            name="Integration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200, unique=True)),
                ("api_url", models.URLField(max_length=500)),
                ("model", models.CharField(max_length=200)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="profile",
            name="integration",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="profiles",
                to="api.integration",
            ),
        ),
        migrations.RunPython(seed_deepseek, unseed_deepseek),
    ]
