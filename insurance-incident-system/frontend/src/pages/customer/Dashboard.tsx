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
          <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and manage your insurance claims
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/tickets/new"
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Claim
          </Link>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No claims</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new insurance claim.
          </p>
          <div className="mt-6">
            <Link to="/tickets/new" className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Claim
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="block hover:bg-gray-50 transition-colors"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-primary-600 truncate">
                            {ticket.ticket_id}
                          </p>
                          <span className="ml-2">
                            <StatusBadge status={ticket.status} />
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-900 font-medium truncate">
                          {ticket.title}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 text-right">
                        <p className="text-sm text-gray-500">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </p>
                        {ticket.claim_amount && (
                          <p className="text-sm font-medium text-gray-900">
                            ${ticket.claim_amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500 capitalize">
                          {ticket.incident_type.replace('_', ' ')}
                        </p>
                        <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                          Incident: {format(new Date(ticket.incident_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {ticket.documents_count !== undefined && (
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <DocumentTextIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
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
