from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_product_images_and_image_generation"),
    ]

    operations = [
        migrations.AddField(
            model_name="integration",
            name="image_model",
            field=models.CharField(blank=True, max_length=300),
        ),
    ]
