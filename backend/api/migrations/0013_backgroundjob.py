from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import api.models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_profile_image_prompt"),
    ]

    operations = [
        migrations.CreateModel(
            name="BackgroundJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "job_type",
                    models.CharField(
                        choices=[
                            ("generate_copy", "Generate descriptions"),
                            ("generate_images", "Generate images"),
                            ("export_csv", "Export CSV"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("queued", "Queued"),
                            ("running", "Running"),
                            ("succeeded", "Succeeded"),
                            ("failed", "Failed"),
                            ("cancelled", "Cancelled"),
                        ],
                        db_index=True,
                        default="queued",
                        max_length=20,
                    ),
                ),
                (
                    "stage",
                    models.CharField(
                        choices=[
                            ("queued", "Waiting in queue"),
                            ("preparing", "Preparing"),
                            ("processing", "Processing items"),
                            ("finalizing", "Finalizing"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="queued",
                        max_length=20,
                    ),
                ),
                ("stage_message", models.CharField(blank=True, max_length=500)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("product_ids", models.JSONField(blank=True, default=list)),
                ("total_count", models.PositiveIntegerField(default=0)),
                ("processed_count", models.PositiveIntegerField(default=0)),
                ("success_count", models.PositiveIntegerField(default=0)),
                ("error_count", models.PositiveIntegerField(default=0)),
                ("cancel_requested", models.BooleanField(default=False)),
                ("error", models.TextField(blank=True)),
                ("result_file", models.FileField(blank=True, upload_to=api.models.background_job_result_path)),
                ("celery_task_id", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="background_jobs",
                        to="api.profile",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="background_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
