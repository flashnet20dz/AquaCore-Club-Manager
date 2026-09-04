"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, Legend,
} from "recharts";
import { TrendingUp, Users, Calendar, Wallet, Loader2, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Analytics {
  revenueEvolution: { label: string; revenue: number; subscribers: number }[];
  attendanceTrend: { date: string; count: number }[];
  ageGroups: { label: string; count: number; color: string }[];
  subTypeData: { name: string; value: number }[];
  payStatusData: { name: string; value: number; color: string }[];
  revenueByType: { name: string; revenue: number }[];
  totals: { subscribers: number; revenue: number; attendance: number; renewals: number };
}

const COLORS = ["#0d9488", "#0891b2", "#6366f1", "#8b5cf6", "#d97706", "#ec4899"];

export function AnalyticsCharts() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={Users} label="إجمالي المنخرطين" value={data.totals.subscribers} color="bg-teal-500/15 text-teal-700" />
        <MiniStat icon={Wallet} label="إجمالي الإيرادات" value={`${data.totals.revenue.toLocaleString()} دج`} color="bg-amber-500/15 text-amber-700" />
        <MiniStat icon={Calendar} label="سجلات الحضور" value={data.totals.attendance} color="bg-violet-500/15 text-violet-700" />
        <MiniStat icon={Activity} label="عمليات التجديد" value={data.totals.renewals} color="bg-emerald-500/15 text-emerald-700" />
      </div>

      {/* Revenue Evolution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card p-5"
      >
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> تطور الإيرادات (آخر 6 أشهر)
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data.revenueEvolution}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} reversed />
            <YAxis tick={{ fontSize: 12 }} orientation="right" />
            <Tooltip
              contentStyle={{ direction: "rtl", borderRadius: "12px", border: "1px solid #e5e7eb" }}
              formatter={(v: number) => [`${v.toLocaleString()} دج`, "الإيرادات"]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2} fill="url(#revGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Attendance Trend + Age Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/60 bg-card p-5"
        >
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> الحضور اليومي (آخر 14 يوم)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.attendanceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} reversed />
              <YAxis tick={{ fontSize: 12 }} orientation="right" allowDecimals={false} />
              <Tooltip
                contentStyle={{ direction: "rtl", borderRadius: "12px" }}
                formatter={(v: number) => [`${v} منخرط`, "الحاضرون"]}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border/60 bg-card p-5"
        >
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> توزيع الفئات العمرية
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.ageGroups} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} orientation="right" />
              <Tooltip contentStyle={{ direction: "rtl", borderRadius: "12px" }} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {data.ageGroups.map((g, i) => <Cell key={i} fill={g.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border/60 bg-card p-5"
        >
          <h3 className="font-bold text-sm mb-4">توزيع أنواع الاشتراك</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={data.subTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {data.subTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {data.subTypeData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="font-bold tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-border/60 bg-card p-5"
        >
          <h3 className="font-bold text-sm mb-4">الإيرادات حسب نوع الاشتراك</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.revenueByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} reversed />
              <YAxis tick={{ fontSize: 11 }} orientation="right" />
              <Tooltip
                contentStyle={{ direction: "rtl", borderRadius: "12px" }}
                formatter={(v: number) => [`${v.toLocaleString()} دج`, "الإيراد"]}
              />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                {data.revenueByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl p-4 ${color}`}
    >
      <Icon className="h-5 w-5 mb-1" />
      <p className="text-xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] opacity-80 mt-1">{label}</p>
    </motion.div>
  );
}
