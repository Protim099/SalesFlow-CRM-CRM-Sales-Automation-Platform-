import { z } from "zod";
import { ACTIVITY_TYPES, LEAD_STATUSES, PRIORITIES, ROLES, STAGE_KINDS, TASK_TYPES, TRIGGERS } from "./constants";

const optText = (max = 500) => z.string().trim().max(max).optional();
const optEmail = z.string().trim().email("Enter a valid email address").max(200).optional().or(z.literal(""));
const money = z.number({ invalid_type_error: "Enter a number" }).int("Whole numbers only").min(0, "Cannot be negative").max(1_000_000_000);

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export const passwordRule = z.string().min(8, "Password must be at least 8 characters").max(100)
  .regex(/[a-zA-Z]/, "Password needs a letter").regex(/[0-9]/, "Password needs a number");
export const registerSchema = z.object({
  orgName: z.string().trim().min(2, "Company name is required").max(80),
  name: z.string().trim().min(2, "Your name is required").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: passwordRule,
});

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: optEmail,
  phone: optText(40),
  companyName: optText(120),
  source: z.string().trim().min(1, "Pick a source").max(60),
  status: z.enum(LEAD_STATUSES),
  priority: z.enum(PRIORITIES),
  value: money,
  notes: optText(5000),
  followUpAt: z.string().optional(),
  assignedToId: z.string().optional(),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
  website: optText(200), industry: optText(80), phone: optText(40), address: optText(300), tags: optText(200),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: optText(80),
  email: optEmail, phone: optText(40), jobTitle: optText(100),
  companyId: z.string().optional(), tags: optText(200),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const dealSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  value: money,
  probability: z.number({ invalid_type_error: "Enter 0-100" }).int().min(0).max(100),
  expectedCloseAt: z.string().optional(),
  stageId: z.string().min(1, "Pick a stage"),
  ownerId: z.string().optional(), contactId: z.string().optional(), companyId: z.string().optional(),
});
export type DealInput = z.infer<typeof dealSchema>;

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: optText(2000),
  type: z.enum(TASK_TYPES), priority: z.enum(PRIORITIES),
  dueAt: z.string().optional(), reminderAt: z.string().optional(),
  assigneeId: z.string().optional(), leadId: z.string().optional(), contactId: z.string().optional(), dealId: z.string().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: optText(5000),
  occurredAt: z.string().optional(),
});
export type ActivityInput = z.infer<typeof activitySchema>;

export const targetSchema = z.object({ type: z.enum(["lead", "contact", "deal"]), id: z.string().min(1) });
export type Target = z.infer<typeof targetSchema>;

export const conditionSchema = z.object({
  field: z.string().min(1), op: z.enum(["eq", "neq", "gte", "lte", "contains"]), value: z.union([z.string(), z.number()]),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ASSIGN_ROUND_ROBIN") }),
  z.object({ type: z.literal("CREATE_TASK"), title: z.string().trim().min(1, "Task title required").max(160), dueInDays: z.number().int().min(0).max(365), taskType: z.enum(TASK_TYPES), priority: z.enum(PRIORITIES) }),
  z.object({ type: z.literal("SEND_EMAIL"), to: z.enum(["owner", "lead"]), subject: z.string().trim().min(1, "Email subject required").max(200), body: z.string().trim().min(1, "Email body required").max(5000) }),
  z.object({ type: z.literal("SET_LEAD_STATUS"), status: z.enum(LEAD_STATUSES) }),
  z.object({ type: z.literal("NOTIFY_OWNER"), message: z.string().trim().min(1, "Message required").max(300) }),
]);
export const ruleSchema = z.object({
  name: z.string().trim().min(2, "Give the rule a name").max(100),
  trigger: z.enum(TRIGGERS),
  conditions: z.array(conditionSchema).max(8),
  actions: z.array(actionSchema).min(1, "Add at least one action").max(6),
});
export type RuleInput = z.infer<typeof ruleSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type ActionDef = z.infer<typeof actionSchema>;

export const orgSchema = z.object({
  name: z.string().trim().min(2).max(80), currency: z.string().length(3), timezone: z.string().max(60),
  monthlyTarget: money,
});
export const stageSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required").max(40), kind: z.enum(STAGE_KINDS),
  probability: z.number().int().min(0).max(100),
});
export const memberSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: passwordRule, role: z.enum(ROLES),
});
export const profileSchema = z.object({ name: z.string().trim().min(2).max(80), emailNotifications: z.boolean() });
export const passwordChangeSchema = z.object({ current: z.string().min(1, "Enter your current password"), next: passwordRule });
export const leadSourcesSchema = z.array(z.string().trim().min(1).max(40)).min(1, "Keep at least one source").max(30);
