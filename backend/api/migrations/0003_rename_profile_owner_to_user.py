from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_prompttemplate"),
    ]

    operations = [
        migrations.RenameField(
            model_name="profile",
            old_name="owner",
            new_name="user",
        ),
    ]
