from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_integration_image_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="image_prompt",
            field=models.TextField(blank=True),
        ),
    ]
