import { MediaDeliveryWorkflow } from "../src/media_delivery.js";

const workflow = new MediaDeliveryWorkflow();
workflow.markPhoneVerified("creator-42");
const job = workflow.ingest("creator-42", "trailer-2026", "festival-cut.mov");
console.log({ job, delivery: workflow.finish(job.id) });
