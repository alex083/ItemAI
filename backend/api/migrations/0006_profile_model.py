from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0005_integration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="integration",
            name="model",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="profile",
            name="model",
            field=models.CharField(blank=True, max_length=300),
        ),
    ]
