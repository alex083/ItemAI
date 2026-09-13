import { IconLoader2, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip } from "@heroui/react";
import { Link } from "react-router-dom";
import { cn } from "cn";

import {
  cancelJob,
  deleteJob,
  listJobs,
  type BackgroundJob,
  type BackgroundJobStatus,
} from "./api";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

type StatusFilter = "all" | BackgroundJobStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Done" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function statusColor(status: BackgroundJobStatus): "accent" | "success" | "warning" | "danger" | "default" {
  if (status === "running") return "accent";
  if (status === "succeeded") return "success";
  if (status === "queued") return "warning";
  if (status === "failed") return "danger";
  return "default";
}

export function JobsPage() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const data = await listJobs();
    setJobs(data);
  }

  useEffect(() => {
    refresh()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load jobs");
      })
      .finally(() => setLoading(false));
  }, []);

  const hasActive = useMemo(
    () => jobs.some((job) => job.status === "queued" || job.status === "running"),
    [jobs],
  );

  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasActive]);

  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((job) => job.status === filter);
  }, [jobs, filter]);

  async function onCancel(jobId: number) {
    setBusyId(jobId);
    setError(null);
    try {
      await cancelJob(jobId);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not cancel job");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(jobId: number) {
    setBusyId(jobId);
    setError(null);
    try {
      await deleteJob(jobId);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete job");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Jobs"
        description="Background tasks for descriptions, images, and CSV exports. Active jobs update automatically."
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      <div
        className="flex w-full gap-1 overflow-x-auto rounded-xl border border-divider bg-background p-1"
        role="tablist"
        aria-label="Filter jobs"
      >
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
              filter === tab.value ? "bg-foreground text-background" : "text-muted hover:text-foreground",
            )}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading jobs…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-divider px-4 py-8 text-center text-sm text-muted">
          No jobs yet. Open a profile and use “Create background job”.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((job) => (
            <Card key={job.id} className="glass-panel rounded-3xl p-1">
              <Card.Content className="flex flex-col gap-4 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold">
                        #{job.id} · {job.job_type_label}
                      </h2>
                      <Chip size="sm" color={statusColor(job.status)} variant="soft">
                        {job.status_label}
                      </Chip>
                      {job.cancel_requested && job.status === "running" ? (
                        <Chip size="sm" color="warning" variant="soft">
                          Stopping…
                        </Chip>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted">
                      Profile:{" "}
                      <Link
                        to={`/profiles/${job.profile}`}
                        className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                      >
                        {job.profile_title}
                      </Link>
                      {" · "}
                      {job.total_count} product{job.total_count === 1 ? "" : "s"}
                    </p>
                    <p className="text-sm text-foreground">{job.stage_message || job.stage_label}</p>
                    {job.error ? <p className="text-sm text-danger">{job.error}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {job.status === "queued" || job.status === "running" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={busyId === job.id}
                        isPending={busyId === job.id}
                        onPress={() => void onCancel(job.id)}
                      >
                        {job.status === "queued" ? "Remove from queue" : "Stop"}
                      </Button>
                    ) : null}
                    {job.result_file ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          window.open(job.result_file!, "_blank", "noopener,noreferrer");
                        }}
                      >
                        Download CSV
                      </Button>
                    ) : null}
                    {job.status !== "running" ? (
                      <Button
                        variant="danger-soft"
                        size="sm"
                        isDisabled={busyId === job.id}
                        onPress={() => void onDelete(job.id)}
                      >
                        {busyId === job.id ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconTrash className="size-4" />
                        )}
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {job.processed_count}/{job.total_count || "—"}
                      {job.success_count || job.error_count
                        ? ` · ${job.success_count} ok / ${job.error_count} failed`
                        : null}
                    </span>
                    <span>{job.progress_percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        job.status === "failed"
                          ? "bg-danger"
                          : job.status === "succeeded"
                            ? "bg-green-500"
                            : "bg-[var(--accent)]",
                      )}
                      style={{ width: `${Math.max(job.progress_percent, job.status === "queued" ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
