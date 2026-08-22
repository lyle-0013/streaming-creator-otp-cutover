import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { MediaDeliveryWorkflow } from "./media_delivery.js";
import { InfraiError, infraiOtpGateway, type OtpGateway } from "./streaming_login.js";

const phoneBody = z.object({
  creatorId: z.string().min(1),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  requestId: z.string().uuid(),
});
const verifyBody = phoneBody.extend({ code: z.string().regex(/^\d{4,8}$/) });
const assetBody = z.object({
  creatorId: z.string().min(1),
  assetId: z.string().min(1),
  sourceName: z.string().min(1),
});
const jobBody = z.object({ jobId: z.string().min(1) });

export function createCreatorDeliveryService(
  otp: OtpGateway = infraiOtpGateway,
  workflow = new MediaDeliveryWorkflow(),
) {
  const app = express();
  app.use(express.json());

  app.post("/login/code", async (req, res, next) => {
    try {
      const input = phoneBody.parse(req.body);
      await otp.send(input.phone, input.requestId);
      res.status(202).json({ creatorId: input.creatorId, state: "code_sent" });
    } catch (error) { next(error); }
  });

  app.post("/login/verify", async (req, res, next) => {
    try {
      const input = verifyBody.parse(req.body);
      await otp.verify(input.phone, input.code, input.requestId);
      workflow.markPhoneVerified(input.creatorId);
      res.json({ creatorId: input.creatorId, state: "verified" });
    } catch (error) { next(error); }
  });

  app.post("/assets", (req, res, next) => {
    try {
      const input = assetBody.parse(req.body);
      res.status(202).json(workflow.ingest(input.creatorId, input.assetId, input.sourceName));
    } catch (error) { next(error); }
  });

  app.post("/jobs/finish", (req, res, next) => {
    try { res.json(workflow.finish(jobBody.parse(req.body).jobId)); }
    catch (error) { next(error); }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "invalid_request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return res.status(status).json({ error: error.code, message: error.message });
    }
    return res.status(409).json({ error: error instanceof Error ? error.message : "request_rejected" });
  });
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  createCreatorDeliveryService().listen(port, () => console.log(`creator delivery service listening on ${port}`));
}
