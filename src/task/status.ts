import { z } from "zod"

export type TaskStatus = "queued" | "running" | "completed" | "failed"

export const taskStatusSchema = z.enum(["queued", "running", "completed", "failed"]) satisfies z.ZodType<TaskStatus>
