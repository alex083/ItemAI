"""Background job orchestration: limits, dispatch, and per-item runners."""

from __future__ import annotations

import logging
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .csv_import import EXPORT_FIELDS, build_product_csv
from .deepseek import DeepSeekError, generate_product_copy
from .image_gen import ImageGenerationError, build_product_image_prompt, generate_product_image
from .models import BackgroundJob, Product, ProductImage, Profile
from .subscriptions import (
    consume_generation_slot,
    consume_image_generation_slot,
    ensure_image_generation_available,
    ensure_key_mode_allowed,
    get_active_subscription,
)

logger = logging.getLogger(__name__)


def _max_concurrent_global() -> int:
    return max(1, int(getattr(settings, "JOB_MAX_CONCURRENT_GLOBAL", 2)))


def _max_concurrent_per_user() -> int:
    return max(1, int(getattr(settings, "JOB_MAX_CONCURRENT_PER_USER", 1)))


def _max_queued_per_user() -> int:
    return max(1, int(getattr(settings, "JOB_MAX_QUEUED_PER_USER", 10)))


def user_active_job_count(user_id: int) -> int:
    return BackgroundJob.objects.filter(
        user_id=user_id,
        status__in=[BackgroundJob.Status.QUEUED, BackgroundJob.Status.RUNNING],
    ).count()


def user_running_job_count(user_id: int) -> int:
    return BackgroundJob.objects.filter(user_id=user_id, status=BackgroundJob.Status.RUNNING).count()


def global_running_job_count() -> int:
    return BackgroundJob.objects.filter(status=BackgroundJob.Status.RUNNING).count()


def ensure_user_can_enqueue(user) -> None:
    active = user_active_job_count(user.id)
    limit = _max_queued_per_user() + _max_concurrent_per_user()
    if active >= limit:
        raise ValidationError(
            {
                "detail": (
                    f"Job queue limit reached ({active}/{limit}). "
                    "Wait for a job to finish or cancel one."
                )
            }
        )


def resolve_product_ids(*, profile: Profile, user, product_ids: list[int] | None, select_all: bool) -> list[int]:
    qs = Product.objects.filter(profile=profile).filter(
        Q(profile__user=user) | Q(profile__user__isnull=True)
    )
    if select_all or not product_ids:
        ids = list(qs.order_by("id").values_list("id", flat=True))
    else:
        requested = list(dict.fromkeys(int(x) for x in product_ids))
        found = set(qs.filter(id__in=requested).values_list("id", flat=True))
        missing = [pid for pid in requested if pid not in found]
        if missing:
            raise ValidationError(
                {"detail": f"Products not found in this profile: {', '.join(map(str, missing))}."}
            )
        ids = [pid for pid in requested if pid in found]
    if not ids:
        raise ValidationError({"detail": "No products selected for this job."})
    return ids


def create_job(
    *,
    user,
    profile: Profile,
    job_type: str,
    product_ids: list[int] | None = None,
    select_all: bool = False,
    prompt: str = "",
    fields: list[str] | None = None,
) -> BackgroundJob:
    ensure_user_can_enqueue(user)
    if profile.user_id not in (None, user.id):
        raise ValidationError({"detail": "You do not have access to this profile."})

    ids = resolve_product_ids(profile=profile, user=user, product_ids=product_ids, select_all=select_all)
    payload: dict = {}
    if prompt.strip():
        payload["prompt"] = prompt.strip()
    if job_type == BackgroundJob.JobType.EXPORT_CSV:
        export_fields = [f for f in (fields or []) if f in EXPORT_FIELDS]
        payload["fields"] = export_fields or list(EXPORT_FIELDS)

    job = BackgroundJob.objects.create(
        user=user,
        profile=profile,
        job_type=job_type,
        status=BackgroundJob.Status.QUEUED,
        stage=BackgroundJob.Stage.QUEUED,
        stage_message="Waiting for free server resources…",
        payload=payload,
        product_ids=ids,
        total_count=len(ids),
    )
    return job


def try_dispatch_jobs() -> list[int]:
    """Claim queued jobs that fit global/per-user concurrency and start workers."""
    from .tasks import process_background_job

    started: list[int] = []
    with transaction.atomic():
        queued = (
            BackgroundJob.objects.select_for_update(skip_locked=True)
            .filter(status=BackgroundJob.Status.QUEUED, cancel_requested=False)
            .order_by("created_at")
        )
        running_global = (
            BackgroundJob.objects.select_for_update()
            .filter(status=BackgroundJob.Status.RUNNING)
            .count()
        )
        per_user_running: dict[int, int] = {}
        for row in (
            BackgroundJob.objects.filter(status=BackgroundJob.Status.RUNNING)
            .values_list("user_id")
            .order_by()
        ):
            uid = row[0]
            per_user_running[uid] = per_user_running.get(uid, 0) + 1

        max_global = _max_concurrent_global()
        max_user = _max_concurrent_per_user()

        for job in queued:
            if running_global >= max_global:
                break
            user_running = per_user_running.get(job.user_id, 0)
            if user_running >= max_user:
                continue
            job.status = BackgroundJob.Status.RUNNING
            job.stage = BackgroundJob.Stage.PREPARING
            job.stage_message = "Starting job…"
            job.started_at = timezone.now()
            job.save(
                update_fields=["status", "stage", "stage_message", "started_at"]
            )
            running_global += 1
            per_user_running[job.user_id] = user_running + 1
            started.append(job.id)

    for job_id in started:
        async_result = process_background_job.delay(job_id)
        BackgroundJob.objects.filter(pk=job_id).update(celery_task_id=async_result.id or "")

    return started


def request_cancel(job: BackgroundJob) -> BackgroundJob:
    if job.status == BackgroundJob.Status.QUEUED:
        job.status = BackgroundJob.Status.CANCELLED
        job.stage = BackgroundJob.Stage.CANCELLED
        job.stage_message = "Cancelled while waiting in queue"
        job.cancel_requested = True
        job.finished_at = timezone.now()
        job.save(
            update_fields=[
                "status",
                "stage",
                "stage_message",
                "cancel_requested",
                "finished_at",
            ]
        )
        try_dispatch_jobs()
        return job

    if job.status == BackgroundJob.Status.RUNNING:
        job.cancel_requested = True
        job.stage_message = "Cancel requested — stopping after current item…"
        job.save(update_fields=["cancel_requested", "stage_message"])
        return job

    raise ValidationError({"detail": "Only queued or running jobs can be cancelled."})


def _mark_cancelled(job: BackgroundJob, message: str = "Cancelled by user") -> None:
    job.status = BackgroundJob.Status.CANCELLED
    job.stage = BackgroundJob.Stage.CANCELLED
    job.stage_message = message
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "stage", "stage_message", "finished_at"])


def _mark_failed(job: BackgroundJob, message: str) -> None:
    job.status = BackgroundJob.Status.FAILED
    job.stage = BackgroundJob.Stage.FAILED
    job.stage_message = "Failed"
    job.error = message[:2000]
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "stage", "stage_message", "error", "finished_at"])


def _mark_succeeded(job: BackgroundJob, message: str = "Completed") -> None:
    job.status = BackgroundJob.Status.SUCCEEDED
    job.stage = BackgroundJob.Stage.COMPLETED
    job.stage_message = message
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "stage", "stage_message", "finished_at"])


def _refresh_cancel(job_id: int) -> bool:
    return BackgroundJob.objects.filter(pk=job_id).values_list("cancel_requested", flat=True).first() is True


def _update_progress(job: BackgroundJob, *, processed: int, message: str) -> None:
    job.processed_count = processed
    job.stage = BackgroundJob.Stage.PROCESSING
    job.stage_message = message
    job.save(update_fields=["processed_count", "stage", "stage_message"])


def process_job(job_id: int) -> None:
    try:
        job = BackgroundJob.objects.select_related("profile", "profile__integration", "user").get(pk=job_id)
    except BackgroundJob.DoesNotExist:
        return

    if job.cancel_requested:
        _mark_cancelled(job)
        try_dispatch_jobs()
        return

    try:
        if job.job_type == BackgroundJob.JobType.GENERATE_COPY:
            _process_generate_copy(job)
        elif job.job_type == BackgroundJob.JobType.GENERATE_IMAGES:
            _process_generate_images(job)
        elif job.job_type == BackgroundJob.JobType.EXPORT_CSV:
            _process_export_csv(job)
        else:
            _mark_failed(job, f"Unknown job type: {job.job_type}")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Job %s failed", job_id)
        job.refresh_from_db()
        if job.status == BackgroundJob.Status.RUNNING:
            _mark_failed(job, str(exc))
    finally:
        try_dispatch_jobs()


def _process_generate_copy(job: BackgroundJob) -> None:
    user = job.user
    profile = job.profile
    ensure_key_mode_allowed(user, profile.key_mode)
    custom_prompt = (job.payload or {}).get("prompt") or ""
    system_prompt = custom_prompt.strip() or profile.get_system_prompt()
    products = list(
        Product.objects.filter(id__in=job.product_ids, profile=profile).order_by("id")
    )
    # Preserve request order
    by_id = {p.id: p for p in products}
    ordered = [by_id[pid] for pid in job.product_ids if pid in by_id]
    job.total_count = len(ordered)
    job.save(update_fields=["total_count"])

    success = 0
    errors = 0
    for index, product in enumerate(ordered, start=1):
        if _refresh_cancel(job.id):
            job.refresh_from_db()
            job.success_count = success
            job.error_count = errors
            job.processed_count = index - 1
            job.save(update_fields=["success_count", "error_count", "processed_count"])
            _mark_cancelled(job)
            return

        _update_progress(
            job,
            processed=index - 1,
            message=f"Generating description {index}/{len(ordered)}: {product.title[:80]}",
        )
        try:
            if profile.key_mode == Profile.KeyMode.PLATFORM:
                subscription = get_active_subscription(user)
                if subscription is None:
                    raise ValueError("Choose a tariff first.")
                if subscription.generation_usage >= subscription.generation_limit:
                    raise ValueError("Generation limit reached.")
            integration = profile.integration
            result = generate_product_copy(
                api_key=profile.resolve_api_key(),
                system_prompt=system_prompt,
                title=product.title,
                base_url=integration.api_url if integration else None,
                model=profile.get_generation_model() or None,
            )
            if profile.key_mode == Profile.KeyMode.PLATFORM:
                consume_generation_slot(user)
            product.description = result["description"]
            product.short_description = result["short_description"]
            product.meta_title = result["meta_title"]
            product.meta_description = result["meta_description"]
            product.bullet_points = result["bullet_points"]
            product.tags = result["tags"]
            product.product_type = result["product_type"]
            product.google_product_category = result["google_product_category"]
            product.google_product_category_path = result["google_product_category_path"]
            product.save(
                update_fields=[
                    "description",
                    "short_description",
                    "meta_title",
                    "meta_description",
                    "bullet_points",
                    "tags",
                    "product_type",
                    "google_product_category",
                    "google_product_category_path",
                ]
            )
            success += 1
        except (DeepSeekError, ValueError, ValidationError) as exc:
            errors += 1
            logger.warning("Copy job item failed product=%s: %s", product.id, exc)
        _update_progress(
            job,
            processed=index,
            message=f"Generated {index}/{len(ordered)}",
        )

    job.success_count = success
    job.error_count = errors
    job.save(update_fields=["success_count", "error_count"])
    if success == 0 and errors > 0:
        _mark_failed(job, f"All {errors} items failed.")
    else:
        _mark_succeeded(job, f"Done: {success} succeeded, {errors} failed.")


def _process_generate_images(job: BackgroundJob) -> None:
    user = job.user
    profile = job.profile
    ensure_key_mode_allowed(user, profile.key_mode)
    ensure_image_generation_available(user)
    image_model = profile.get_image_model()
    if not image_model:
        _mark_failed(job, "Set an image model on the profile or integration first.")
        return

    custom_prompt = (job.payload or {}).get("prompt") or ""
    products = list(Product.objects.filter(id__in=job.product_ids, profile=profile).order_by("id"))
    by_id = {p.id: p for p in products}
    ordered = [by_id[pid] for pid in job.product_ids if pid in by_id]
    job.total_count = len(ordered)
    job.save(update_fields=["total_count"])

    success = 0
    errors = 0
    for index, product in enumerate(ordered, start=1):
        if _refresh_cancel(job.id):
            job.refresh_from_db()
            job.success_count = success
            job.error_count = errors
            job.processed_count = index - 1
            job.save(update_fields=["success_count", "error_count", "processed_count"])
            _mark_cancelled(job)
            return

        _update_progress(
            job,
            processed=index - 1,
            message=f"Generating image {index}/{len(ordered)}: {product.title[:80]}",
        )
        try:
            if profile.key_mode == Profile.KeyMode.PLATFORM:
                subscription = get_active_subscription(user)
                if subscription is None:
                    raise ValueError("Choose a tariff first.")
                if subscription.image_generation_usage >= subscription.image_generation_limit:
                    raise ValueError("Image generation limit reached.")

            reference = (
                product.images.filter(is_primary=True).first()
                or product.images.order_by("created_at").first()
            )
            if reference is None or not reference.image:
                raise ValueError("Upload a reference photo first.")
            try:
                reference_bytes = reference.image.read()
            finally:
                reference.image.close()
            if not reference_bytes:
                raise ValueError("Could not read the reference photo.")

            prompt = build_product_image_prompt(
                title=product.title,
                image_prompt=profile.get_image_prompt(),
                custom_prompt=custom_prompt,
                description=product.description,
                short_description=product.short_description,
                product_type=product.product_type,
                tags=product.tags,
                has_reference=True,
            )
            integration = profile.integration
            image_bytes = generate_product_image(
                api_key=profile.resolve_api_key(),
                title=product.title,
                prompt=prompt,
                base_url=integration.api_url if integration else None,
                model=image_model,
                reference_image=reference_bytes,
            )
            if profile.key_mode == Profile.KeyMode.PLATFORM:
                consume_image_generation_slot(user)

            image = ProductImage.objects.create(product=product, source=ProductImage.Source.GENERATED)
            image.image.save(f"{uuid.uuid4().hex}.png", ContentFile(image_bytes), save=True)
            if not product.images.filter(is_primary=True).exclude(pk=image.pk).exists():
                image.is_primary = True
                image.save(update_fields=["is_primary"])
            success += 1
        except (ImageGenerationError, ValueError, ValidationError) as exc:
            errors += 1
            logger.warning("Image job item failed product=%s: %s", product.id, exc)

        _update_progress(job, processed=index, message=f"Images {index}/{len(ordered)}")

    job.success_count = success
    job.error_count = errors
    job.save(update_fields=["success_count", "error_count"])
    if success == 0 and errors > 0:
        _mark_failed(job, f"All {errors} items failed.")
    else:
        _mark_succeeded(job, f"Done: {success} succeeded, {errors} failed.")


def _process_export_csv(job: BackgroundJob) -> None:
    job.stage = BackgroundJob.Stage.PREPARING
    job.stage_message = "Preparing CSV export…"
    job.save(update_fields=["stage", "stage_message"])

    if _refresh_cancel(job.id):
        _mark_cancelled(job)
        return

    products = list(
        Product.objects.filter(id__in=job.product_ids, profile=job.profile)
        .prefetch_related("images")
        .order_by("id")
    )
    by_id = {p.id: p for p in products}
    ordered = [by_id[pid] for pid in job.product_ids if pid in by_id]
    job.total_count = len(ordered)
    job.processed_count = 0
    job.save(update_fields=["total_count", "processed_count"])

    if _refresh_cancel(job.id):
        _mark_cancelled(job)
        return

    job.stage = BackgroundJob.Stage.FINALIZING
    job.stage_message = f"Writing CSV for {len(ordered)} products…"
    job.processed_count = len(ordered)
    job.save(update_fields=["stage", "stage_message", "processed_count"])

    fields = (job.payload or {}).get("fields") or list(EXPORT_FIELDS)
    csv_bytes = build_product_csv(ordered, fields)
    filename = f"products-profile-{job.profile_id}-job-{job.id}.csv"
    job.result_file.save(filename, ContentFile(csv_bytes), save=True)
    job.success_count = len(ordered)
    job.save(update_fields=["success_count", "result_file"])
    _mark_succeeded(job, f"CSV ready ({len(ordered)} products).")
