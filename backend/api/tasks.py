from celery import shared_task


@shared_task(bind=True, ignore_result=True)
def process_background_job(self, job_id: int) -> None:
    from .jobs import process_job

    process_job(job_id)


@shared_task(ignore_result=True)
def dispatch_background_jobs() -> None:
    from .jobs import try_dispatch_jobs

    try_dispatch_jobs()
