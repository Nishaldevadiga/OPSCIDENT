import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../../services/api';
import type { Ticket } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function CustomerDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const response = await ticketsApi.list();
      setTickets(response.results);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">My Claims</h1>
          <p className="mt-1 text-sm text-slate-400">
            View and manage your insurance claims
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link to="/tickets/new" className="btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            New Claim
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-16 card">
          <DocumentTextIcon className="mx-auto h-14 w-14 text-slate-500" />
          <h3 className="mt-4 text-lg font-medium text-slate-200">No claims</h3>
          <p className="mt-2 text-sm text-slate-400">
            Get started by creating a new insurance claim.
          </p>
          <div className="mt-8">
            <Link to="/tickets/new" className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Claim
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-700">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/tickets/${ticket.id}`} className="block hover:bg-slate-800/50 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-primary-400 truncate">
                            {ticket.ticket_id}
                          </p>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-200 font-medium truncate">
                          {ticket.title}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 text-right">
                        <p className="text-sm text-slate-500">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </p>
                        {ticket.claim_amount && (
                          <p className="text-sm font-medium text-slate-100">
                            ${ticket.claim_amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex gap-6">
                        <p className="text-sm text-slate-500 capitalize">
                          {ticket.incident_type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-slate-500">
                          Incident: {format(new Date(ticket.incident_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {ticket.documents_count !== undefined && (
                        <div className="mt-2 flex items-center text-sm text-slate-500 sm:mt-0">
                          <DocumentTextIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-slate-500" />
                          {ticket.documents_count} document{ticket.documents_count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
