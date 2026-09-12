from django.db import migrations, models


def seed_key_modes(apps, _schema_editor):
    Profile = apps.get_model("api", "Profile")
    # Existing profiles already store their own keys.
    Profile.objects.filter(DeepSeekApiKey__gt="").update(key_mode="byok")
    Profile.objects.filter(DeepSeekApiKey="").update(key_mode="platform")


def noop_reverse(_apps, _schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0007_product_generated_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="integration",
            name="api_key",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="integration",
            name="is_platform_default",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="profile",
            name="key_mode",
            field=models.CharField(
                choices=[("platform", "Platform key"), ("byok", "Bring your own key")],
                default="platform",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="profile",
            name="DeepSeekApiKey",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.RunPython(seed_key_modes, noop_reverse),
    ]
