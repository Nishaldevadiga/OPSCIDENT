import type { TicketStatus } from '../types';

interface StatusBadgeProps {
  status: TicketStatus;
}

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-100 text-blue-800',
  },
  processing: {
    label: 'Processing',
    className: 'bg-yellow-100 text-yellow-800',
  },
  pending_info: {
    label: 'Pending Info',
    className: 'bg-orange-100 text-orange-800',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
