import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import { agentApi } from '../../services/api';
import type { Ticket } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type ModalType = 'approve' | 'reject' | 'request_info' | 'add_note' | null;

export default function AgentTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState<ModalType>(null);
  const [actionReason, setActionReason] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      loadTicket();
    }
  }, [id]);

  const loadTicket = async () => {
    try {
      const data = await agentApi.getTicket(parseInt(id!));
      setTicket(data);
    } catch (error) {
      console.error('Failed to load ticket:', error);
      toast.error('Failed to load ticket details');
      navigate('/agent/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!modalOpen) return;

    if (modalOpen === 'reject' && !actionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    if (modalOpen === 'request_info' && !actionReason.trim()) {
      toast.error('Please provide a message for the customer');
      return;
    }

    setSubmitting(true);
    try {
      switch (modalOpen) {
        case 'approve':
          await agentApi.approveTicket(parseInt(id!), actionReason);
          toast.success('Ticket approved successfully');
          break;
        case 'reject':
          await agentApi.rejectTicket(parseInt(id!), actionReason);
          toast.success('Ticket rejected');
          break;
        case 'request_info':
          await agentApi.requestInfo(parseInt(id!), actionReason);
          toast.success('Information request sent to customer');
          break;
        case 'add_note':
          await agentApi.addNote(parseInt(id!), actionReason, noteInternal);
          toast.success('Note added');
          break;
      }
      setModalOpen(null);
      setActionReason('');
      loadTicket();
    } catch (error) {
      toast.error('Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const canTakeAction = !['approved', 'rejected'].includes(ticket.status);
  const analysis = ticket.ai_analysis;

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={() => navigate('/agent/dashboard')}
        className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{ticket.ticket_id}</h1>
                  <p className="text-sm text-gray-500 mt-1">{ticket.title}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Customer</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {ticket.customer.first_name} {ticket.customer.last_name}
                </p>
                <p className="text-sm text-gray-500">{ticket.customer.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Incident Type</h3>
                <p className="mt-1 text-sm text-gray-900 capitalize">
                  {ticket.incident_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Incident Date</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {format(new Date(ticket.incident_date), 'MMMM d, yyyy')}
                </p>
              </div>
              {ticket.claim_amount && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Claim Amount</h3>
                  <p className="mt-1 text-sm text-gray-900 font-semibold">
                    ${ticket.claim_amount.toLocaleString()}
                  </p>
                </div>
              )}
              {ticket.incident_location && (
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500">Location</h3>
                  <p className="mt-1 text-sm text-gray-900">{ticket.incident_location}</p>
                </div>
              )}
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>
            </div>

            {ticket.documents && ticket.documents.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {ticket.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded flex items-center justify-center ${
                        doc.file_type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {doc.file_type === 'pdf' ? (
                          <DocumentTextIcon className="h-5 w-5" />
                        ) : (
                          <PhotoIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="ml-3 overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {doc.file_type.toUpperCase()}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {ticket.notes && ticket.notes.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Notes</h3>
                <div className="space-y-3">
                  {ticket.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-lg p-3 ${
                        note.is_internal ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {note.author_name}
                          {note.is_internal && (
                            <span className="ml-2 text-xs text-yellow-600">(Internal)</span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(note.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {analysis && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center">
                  <SparklesIcon className="h-5 w-5 text-purple-500 mr-2" />
                  <h3 className="text-sm font-medium text-gray-900">AI Analysis</h3>
                </div>
              </div>
              <div className="px-4 py-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-500">Recommendation</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      analysis.recommendation === 'approve'
                        ? 'bg-green-100 text-green-800'
                        : analysis.recommendation === 'reject'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {analysis.recommendation === 'approve' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'reject' && <XCircleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'review' && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation.charAt(0).toUpperCase() + analysis.recommendation.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-medium">{(analysis.confidence_score * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {analysis.damage_score !== null && analysis.damage_score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-500">Damage Score</span>
                      <span className="text-sm font-medium">{analysis.damage_score}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          analysis.damage_score >= 70
                            ? 'bg-red-500'
                            : analysis.damage_score >= 40
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${analysis.damage_score}%` }}
                      />
                    </div>
                  </div>
                )}

                {analysis.fraud_indicators && analysis.fraud_indicators.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-red-600">Fraud Indicators</span>
                    <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
                      {analysis.fraud_indicators.map((indicator, idx) => (
                        <li key={idx}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.analysis_summary && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Summary</span>
                    <p className="mt-1 text-sm text-gray-700">{analysis.analysis_summary}</p>
                  </div>
                )}

                <div className="flex items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span className={`w-2 h-2 rounded-full mr-1 ${analysis.is_complete ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  {analysis.is_complete ? 'Analysis complete' : 'Analysis in progress'}
                </div>
              </div>
            </div>
          )}

          {canTakeAction && (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900">Actions</h3>
              </div>
              <div className="px-4 py-4 space-y-3">
                <button
                  onClick={() => setModalOpen('approve')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Approve
                </button>
                <button
                  onClick={() => setModalOpen('reject')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  <XCircleIcon className="h-5 w-5 mr-2" />
                  Reject
                </button>
                <button
                  onClick={() => setModalOpen('request_info')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <InformationCircleIcon className="h-5 w-5 mr-2" />
                  Request Info
                </button>
                <button
                  onClick={() => setModalOpen('add_note')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="h-5 w-5 mr-2" />
                  Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Transition appear show={modalOpen !== null} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setModalOpen(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {modalOpen === 'approve' && 'Approve Ticket'}
                    {modalOpen === 'reject' && 'Reject Ticket'}
                    {modalOpen === 'request_info' && 'Request Information'}
                    {modalOpen === 'add_note' && 'Add Note'}
                  </Dialog.Title>
                  <div className="mt-4">
                    <textarea
                      rows={4}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder={
                        modalOpen === 'approve'
                          ? 'Add a note (optional)...'
                          : modalOpen === 'reject'
                          ? 'Provide reason for rejection...'
                          : modalOpen === 'request_info'
                          ? 'What information do you need?'
                          : 'Enter your note...'
                      }
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                    />
                    {modalOpen === 'add_note' && (
                      <label className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          checked={noteInternal}
                          onChange={(e) => setNoteInternal(e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          Internal note (not visible to customer)
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setModalOpen(null);
                        setActionReason('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={
                        modalOpen === 'approve'
                          ? 'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700'
                          : modalOpen === 'reject'
                          ? 'btn-danger'
                          : 'btn-primary'
                      }
                      onClick={handleAction}
                      disabled={submitting}
                    >
                      {submitting ? <LoadingSpinner size="sm" /> : 'Confirm'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
