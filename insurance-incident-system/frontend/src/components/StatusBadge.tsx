import type { TicketStatus } from '../types';

interface StatusBadgeProps {
  status: TicketStatus;
}

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  submitted: {
    label: 'Submitted',
    className: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
  },
  processing: {
    label: 'Processing',
    className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  pending_info: {
    label: 'Pending Info',
    className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-600 text-slate-300 border border-slate-500' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
