export type Asset = { id: string; creatorId: string; sourceName: string };
export type ProcessingJob = { id: string; assetId: string; state: "queued" | "ready" };
export type CreatorDelivery = { assetId: string; creatorId: string; state: "available" };

export class MediaDeliveryWorkflow {
  private readonly verifiedCreators = new Set<string>();
  private readonly assets = new Map<string, Asset>();
  private readonly jobs = new Map<string, ProcessingJob>();

  markPhoneVerified(creatorId: string): void {
    this.verifiedCreators.add(creatorId);
  }

  ingest(creatorId: string, assetId: string, sourceName: string): ProcessingJob {
    if (!this.verifiedCreators.has(creatorId)) {
      throw new Error("phone verification required before asset ingestion");
    }
    this.assets.set(assetId, { id: assetId, creatorId, sourceName });
    const job = { id: `job-${assetId}`, assetId, state: "queued" as const };
    this.jobs.set(job.id, job);
    return job;
  }

  finish(jobId: string): CreatorDelivery {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error("processing job not found");
    const asset = this.assets.get(job.assetId);
    if (!asset) throw new Error("asset not found");
    this.jobs.set(jobId, { ...job, state: "ready" });
    return { assetId: asset.id, creatorId: asset.creatorId, state: "available" };
  }
}
