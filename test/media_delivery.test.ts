import assert from "node:assert/strict";
import test from "node:test";
import { MediaDeliveryWorkflow } from "../src/media_delivery.js";

test("a verified creator can move an ingested asset to available delivery", () => {
  const workflow = new MediaDeliveryWorkflow();
  assert.throws(
    () => workflow.ingest("creator-42", "trailer-2026", "festival-cut.mov"),
    /phone verification required/,
  );

  workflow.markPhoneVerified("creator-42");
  const job = workflow.ingest("creator-42", "trailer-2026", "festival-cut.mov");
  assert.deepEqual(job, { id: "job-trailer-2026", assetId: "trailer-2026", state: "queued" });
  assert.deepEqual(workflow.finish(job.id), {
    assetId: "trailer-2026",
    creatorId: "creator-42",
    state: "available",
  });
});
