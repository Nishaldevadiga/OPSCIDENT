import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';
import { agentApi } from '../../services/api';
import type { Ticket } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import FraudRiskPanel from '../../components/FraudRiskPanel';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
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
  const [approvedAmount, setApprovedAmount] = useState('');
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
          await agentApi.approveTicket(parseInt(id!), actionReason, approvedAmount ? parseFloat(approvedAmount) : undefined);
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
      setApprovedAmount('');
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
      <button onClick={() => navigate('/agent/dashboard')} className="flex items-center text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors">
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-50">{ticket.ticket_id}</h1>
                  <p className="text-sm text-slate-400 mt-1">{ticket.title}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500">Customer</h3>
                <p className="mt-1 text-sm text-slate-200">
                  {ticket.customer.first_name} {ticket.customer.last_name}
                </p>
                <p className="text-sm text-slate-500">{ticket.customer.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500">Incident Type</h3>
                <p className="mt-1 text-sm text-slate-200 capitalize">
                  {ticket.incident_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-500">Incident Date</h3>
                <p className="mt-1 text-sm text-slate-200">
                  {format(new Date(ticket.incident_date), 'MMMM d, yyyy')}
                </p>
              </div>
              {ticket.claim_amount && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500">Claim Amount</h3>
                  <p className="mt-1 text-sm text-slate-200 font-semibold">
                    ${ticket.claim_amount.toLocaleString()}
                  </p>
                </div>
              )}
              {ticket.incident_location && (
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-slate-500">Location</h3>
                  <p className="mt-1 text-sm text-slate-200">{ticket.incident_location}</p>
                </div>
              )}
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-slate-500">Description</h3>
                <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>
            </div>

            {ticket.documents && ticket.documents.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-200 mb-3">Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {ticket.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center p-3 border border-slate-600 rounded-xl hover:bg-slate-800/50 transition-colors"
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded flex items-center justify-center ${
                        doc.file_type === 'pdf' ? 'bg-rose-500/20 text-rose-400' :
                        doc.file_type === 'video' ? 'bg-violet-500/20 text-violet-400' :
                        'bg-sky-500/20 text-sky-400'
                      }`}>
                        {doc.file_type === 'pdf' ? (
                          <DocumentTextIcon className="h-5 w-5" />
                        ) : doc.file_type === 'video' ? (
                          <FilmIcon className="h-5 w-5" />
                        ) : (
                          <PhotoIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="ml-3 overflow-hidden">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-slate-500">
                          {doc.file_type.toUpperCase()}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {ticket.notes && ticket.notes.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-700">
                <h3 className="text-sm font-medium text-slate-200 mb-3">Notes</h3>
                <div className="space-y-3">
                  {ticket.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-xl p-3 ${
                        note.is_internal ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50 border border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-200">
                          {note.author_name}
                          {note.is_internal && (
                            <span className="ml-2 text-xs text-amber-400">(Internal)</span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500">
                          {format(new Date(note.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {analysis && (
            <div className="card overflow-hidden">
              <div className={`px-4 py-3 border-b border-slate-700 ${analysis.fraud_indicators?.length ? 'bg-gradient-to-r from-rose-500/10 to-orange-500/10' : 'bg-gradient-to-r from-primary-500/10 to-sky-500/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SparklesIcon className="h-5 w-5 text-primary-400 mr-2" />
                    <h3 className="text-sm font-medium text-slate-200">AI Analysis</h3>
                  </div>
                  {analysis.fraud_indicators?.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      <ExclamationTriangleIcon className="h-3 w-3" />
                      {analysis.fraud_indicators.length} flag{analysis.fraud_indicators.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-4 py-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-500">AI Decision</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      analysis.recommendation === 'approve'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : analysis.recommendation === 'reject'
                        ? 'bg-rose-500/20 text-rose-400'
                        : analysis.recommendation === 'need_info'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {analysis.recommendation === 'approve' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'reject' && <XCircleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'need_info' && <InformationCircleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'review' && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                      {analysis.recommendation === 'approve' ? 'Auto-Approved' :
                       analysis.recommendation === 'reject' ? 'Auto-Rejected' :
                       analysis.recommendation === 'need_info' ? 'Needs Review' :
                       'Manual Review'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Confidence</span>
                    <span className="font-medium">{(analysis.confidence_score * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {analysis.damage_score !== null && analysis.damage_score !== undefined && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-500">Damage Score</span>
                      <span className="text-sm font-medium">{analysis.damage_score}/100</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          analysis.damage_score >= 70
                            ? 'bg-rose-500'
                            : analysis.damage_score >= 40
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${analysis.damage_score}%` }}
                      />
                    </div>
                  </div>
                )}

                {analysis.claim_amount_min != null && analysis.claim_amount_max != null && (
                  <div className="rounded-xl bg-primary-500/10 border border-primary-500/25 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <SparklesIcon className="h-4 w-4 text-primary-400" />
                      <span className="text-xs font-semibold text-primary-400 uppercase tracking-wide">AI Recommended Payout</span>
                    </div>
                    <p className="text-lg font-bold text-slate-100">
                      ${Number(analysis.claim_amount_min).toLocaleString()} – ${Number(analysis.claim_amount_max).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Estimated range based on damage assessment</p>
                  </div>
                )}

                {analysis.fraud_indicators && analysis.fraud_indicators.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-rose-400">Fraud Indicators</span>
                    <ul className="mt-1 text-sm text-rose-400 list-disc list-inside">
                      {analysis.fraud_indicators.map((indicator, idx) => (
                        <li key={idx}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.analysis_summary && (
                  <div>
                    <span className="text-sm font-medium text-slate-500">Summary</span>
                    <p className="mt-1 text-sm text-slate-300">{analysis.analysis_summary}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-700">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-1 ${analysis.is_complete ? 'bg-green-400' : 'bg-yellow-400'}`} />
                    {analysis.is_complete ? 'Analysis complete' : 'Analysis in progress'}
                  </div>
                  <a href="#fraud-panel" className="text-primary-400 hover:text-primary-300 transition-colors">
                    Full report ↓
                  </a>
                </div>
              </div>
            </div>
          )}

          {canTakeAction && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="text-sm font-medium text-slate-200">Actions</h3>
              </div>
              <div className="px-4 py-4 space-y-3">
                <button
                  onClick={() => setModalOpen('approve')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Approve
                </button>
                <button
                  onClick={() => setModalOpen('reject')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-rose-600 hover:bg-rose-500 transition-colors"
                >
                  <XCircleIcon className="h-5 w-5 mr-2" />
                  Reject
                </button>
                <button
                  onClick={() => setModalOpen('request_info')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <InformationCircleIcon className="h-5 w-5 mr-2" />
                  Request Info
                </button>
                <button
                  onClick={() => setModalOpen('add_note')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <DocumentTextIcon className="h-5 w-5 mr-2" />
                  Add Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fraud Risk Panel ── */}
      {analysis && (
        <div id="fraud-panel">
          <FraudRiskPanel analysis={analysis} ticket={ticket} />
        </div>
      )}

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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-slate-100"
                  >
                    {modalOpen === 'approve' && 'Approve Ticket'}
                    {modalOpen === 'reject' && 'Reject Ticket'}
                    {modalOpen === 'request_info' && 'Request Information'}
                    {modalOpen === 'add_note' && 'Add Note'}
                  </Dialog.Title>
                  <div className="mt-4 space-y-3">
                    {modalOpen === 'approve' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                          Approved Payout Amount ($) <span className="text-slate-500 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={approvedAmount}
                            onChange={(e) => setApprovedAmount(e.target.value)}
                            className="block w-full rounded-lg border border-slate-600 bg-slate-800 pl-7 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none text-sm"
                          />
                        </div>
                        {ticket?.ai_analysis?.claim_amount_min != null && (
                          <p className="mt-1 text-xs text-primary-400">
                            AI estimate: ${Number(ticket.ai_analysis.claim_amount_min).toLocaleString()} – ${Number(ticket.ai_analysis.claim_amount_max).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                    <textarea
                      rows={3}
                      className="block w-full rounded-lg border-slate-600 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
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
                          className="rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-slate-400">
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
                          ? 'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-slate-950 bg-emerald-500 hover:bg-emerald-400'
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
