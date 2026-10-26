import { prisma } from "@/lib/db";
import { generateReminders } from "@/lib/automation";
export const dynamic = "force-dynamic";

/** Call from a scheduler: curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let n = 0;
  for (const o of await prisma.organization.findMany({ select: { id: true } })) n += await generateReminders(o.id);
  return Response.json({ processed: n });
}
