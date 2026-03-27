import { useState, useEffect } from 'react';
import { agentApi } from '../../services/api';
import type { AnalyticsData } from '../../types';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const INCIDENT_LABELS: Record<string, string> = {
  vehicle_collision: 'Vehicle Collision',
  vehicle_theft: 'Vehicle Theft',
  property_damage: 'Property Damage',
  natural_disaster: 'Natural Disaster',
  personal_injury: 'Personal Injury',
  other: 'Other',
};

const PIE_COLORS = ['#38bdf8', '#10b981', '#a78bfa', '#f59e0b', '#f43f5e', '#64748b'];

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const tooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: 12,
};

export default function AgentAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    agentApi.getAnalytics()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 text-slate-400">
        <ChartBarIcon className="mx-auto h-12 w-12 mb-3 text-slate-600" />
        <p>Failed to load analytics data.</p>
      </div>
    );
  }

  const { kpis, daily, weekly, by_incident_type } = data;

  // Format daily dates to short label
  const dailyChart = daily.map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }));

  // Format weekly dates
  const weeklyChart = weekly.map((w) => ({
    ...w,
    label: `W/O ${format(parseISO(w.week), 'MMM d')}`,
  }));

  // Pie data
  const pieData = by_incident_type.map((t, i) => ({
    name: INCIDENT_LABELS[t.incident_type] ?? t.incident_type,
    value: t.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">Claims performance overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-sky-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total Claims</p>
              <p className="text-2xl font-bold text-slate-100">{kpis.total_claims.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Approval Rate</p>
              <p className="text-2xl font-bold text-emerald-400">{kpis.approval_rate}%</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-violet-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Avg Processing</p>
              <p className="text-2xl font-bold text-slate-100">{formatHours(kpis.avg_processing_hours)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="h-8 w-8 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total Payout</p>
              <p className="text-2xl font-bold text-slate-100">${kpis.total_payout.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily submissions — area chart */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-4">Daily Submissions — Last 30 Days</h2>
        {dailyChart.every((d) => d.total === 0) ? (
          <p className="text-sm text-slate-500 text-center py-10">No submissions in the last 30 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                interval={4}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: '#334155' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Submitted"
                stroke="#38bdf8"
                strokeWidth={2}
                fill="url(#gradTotal)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Weekly approvals vs rejections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Weekly Approvals vs Rejections</h2>
          {weeklyChart.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Claims by incident type — donut */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Claims by Incident Type</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No data yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, 'Claims']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-2">
                {pieData.map((entry, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate flex-1">{entry.name}</span>
                    <span className="font-medium text-slate-100">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Weekly payout */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-slate-300 mb-4">Weekly Payout Disbursed</h2>
        {weeklyChart.every((w) => w.payout === 0) ? (
          <p className="text-sm text-slate-500 text-center py-10">No approved payouts recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Payout']}
              />
              <Bar dataKey="payout" name="Payout" fill="url(#gradPayout)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
