from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_backgroundjob"),
    ]

    operations = [
        migrations.AddField(
            model_name="prompttemplate",
            name="prompt_type",
            field=models.CharField(
                choices=[("description", "Description"), ("image", "Image")],
                default="description",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="prompttemplate",
            name="category",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AlterModelOptions(
            name="prompttemplate",
            options={"ordering": ["category", "title"]},
        ),
    ]
