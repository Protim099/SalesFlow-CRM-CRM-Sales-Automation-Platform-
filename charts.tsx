"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { fmtCompact } from "@/lib/utils";

const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899"];
const axis = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
const Empty = () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data for this period</div>;

export function RevenueChart({ data, currency = "USD", showLost }: { data: { month: string; revenue: number; lost?: number }[]; currency?: string; showLost?: boolean }) {
  if (!data.some((d) => d.revenue || d.lost)) return <div className="h-64"><Empty /></div>;
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
          <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
          <Tooltip {...tip} formatter={(v: number) => fmt(v)} />
          <Area type="monotone" dataKey="revenue" name="Won" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
          {showLost && <Area type="monotone" dataKey="lost" name="Lost" stroke="#ef4444" strokeWidth={2} fill="transparent" />}
          {showLost && <Legend />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <div className="h-64"><Empty /></div>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
          <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, xKey, yKey, horizontal, name }: { data: Record<string, string | number>[]; xKey: string; yKey: string; horizontal?: boolean; name?: string }) {
  if (!data.length || !data.some((d) => Number(d[yKey]))) return <div className="h-64"><Empty /></div>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 24 : -10, right: 12, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={!horizontal} vertical={!!horizontal} />
          {horizontal ? <><XAxis type="number" tick={axis} tickLine={false} axisLine={false} /><YAxis type="category" dataKey={xKey} tick={axis} tickLine={false} axisLine={false} width={90} /></>
            : <><XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={false} /><YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtCompact} /></>}
          <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey={yKey} name={name ?? yKey} radius={4}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
