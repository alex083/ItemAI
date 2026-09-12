from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0008_integration_platform_key"),
    ]

    operations = [
        migrations.CreateModel(
            name="Tariff",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "keypolicy",
                    models.CharField(
                        choices=[
                            ("hybrid", "Hybrid"),
                            ("platform_key", "Platform Key"),
                            ("byok", "BYOK"),
                        ],
                        default="hybrid",
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("price", models.DecimalField(decimal_places=2, max_digits=10)),
                ("number_of_products", models.IntegerField()),
                ("number_of_profiles", models.IntegerField()),
                ("number_of_generations", models.IntegerField()),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["title", "price"],
            },
        ),
        migrations.CreateModel(
            name="UserSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "keypolicy",
                    models.CharField(
                        choices=[
                            ("hybrid", "Hybrid"),
                            ("platform_key", "Platform Key"),
                            ("byok", "BYOK"),
                        ],
                        default="hybrid",
                        max_length=20,
                    ),
                ),
                ("product_limit", models.IntegerField()),
                ("profile_limit", models.IntegerField()),
                ("generation_limit", models.IntegerField()),
                ("product_usage", models.IntegerField(default=0)),
                ("profile_usage", models.IntegerField(default=0)),
                ("generation_usage", models.IntegerField(default=0)),
                ("start_date", models.DateTimeField(auto_now_add=True)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "tariff",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subscriptions",
                        to="api.tariff",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subscriptions",
                        to="api.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-start_date", "tariff"],
            },
        ),
    ]
