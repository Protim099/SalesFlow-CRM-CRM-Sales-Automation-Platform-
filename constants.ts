export const ROLES = ["ADMIN", "SALES_MANAGER", "SALES_REP"] as const;
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const TASK_TYPES = ["CALL", "MEETING", "EMAIL", "TASK"] as const;
export const ACTIVITY_TYPES = ["CALL", "MEETING", "EMAIL", "NOTE"] as const;
export const STAGE_KINDS = ["OPEN", "WON", "LOST"] as const;
export const TRIGGERS = ["LEAD_CREATED", "LEAD_STATUS_CHANGED", "DEAL_STAGE_CHANGED"] as const;

export type Role = (typeof ROLES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type ActivityKind = (typeof ACTIVITY_TYPES)[number] | "SYSTEM";
export type StageKind = (typeof STAGE_KINDS)[number];
export type Trigger = (typeof TRIGGERS)[number];

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", SALES_MANAGER: "Sales Manager", SALES_REP: "Sales Representative" };
export const STATUS_LABEL: Record<LeadStatus, string> = { NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", UNQUALIFIED: "Unqualified", CONVERTED: "Converted" };
export const TRIGGER_LABEL: Record<Trigger, string> = {
  LEAD_CREATED: "A lead is created",
  LEAD_STATUS_CHANGED: "A lead's status changes",
  DEAL_STAGE_CHANGED: "A deal moves to another stage",
};

export const STATUS_STYLE: Record<LeadStatus, string> = {
  NEW: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  CONTACTED: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  QUALIFIED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  UNQUALIFIED: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  CONVERTED: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};
export const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  HIGH: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export const DEFAULT_LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "Email Campaign", "Trade Show", "Partner", "Other"];
export const DEFAULT_STAGES: { name: string; kind: StageKind; probability: number }[] = [
  { name: "New", kind: "OPEN", probability: 10 },
  { name: "Qualified", kind: "OPEN", probability: 30 },
  { name: "Proposal", kind: "OPEN", probability: 50 },
  { name: "Negotiation", kind: "OPEN", probability: 70 },
  { name: "Won", kind: "WON", probability: 100 },
  { name: "Lost", kind: "LOST", probability: 0 },
];
export const CURRENCIES = ["USD", "EUR", "GBP", "BDT", "INR", "AUD", "CAD", "JPY"];

/** Fields usable in automation conditions, per trigger family. */
export const CONDITION_FIELDS = {
  lead: [
    { key: "status", label: "Lead status", options: LEAD_STATUSES as readonly string[] },
    { key: "priority", label: "Priority", options: PRIORITIES as readonly string[] },
    { key: "source", label: "Source", options: null },
    { key: "value", label: "Estimated value", options: null },
    { key: "assigned", label: "Is assigned", options: ["yes", "no"] },
  ],
  deal: [
    { key: "stage", label: "New stage name", options: null },
    { key: "value", label: "Deal value", options: null },
  ],
} as const;
