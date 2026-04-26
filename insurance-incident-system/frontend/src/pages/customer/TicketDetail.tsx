import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ticketsApi, documentsApi } from '../../services/api';
import type { Ticket, TicketStatus } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import FileUpload from '../../components/FileUpload';
import LiveStatusTracker from '../../components/LiveStatusTracker';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  ClockIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function CustomerTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  useEffect(() => {
    if (id) loadTicket();
  }, [id]);

  const loadTicket = async () => {
    try {
      const data = await ticketsApi.get(parseInt(id!));
      setTicket(data);
    } catch (error) {
      console.error('Failed to load ticket:', error);
      toast.error('Failed to load ticket details');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseText.trim()) return;
    setSubmitting(true);
    try {
      await ticketsApi.respond(parseInt(id!), responseText);
      toast.success('Response submitted successfully');
      setResponseText('');
      loadTicket();
    } catch {
      toast.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFiles = async () => {
    if (newFiles.length === 0) return;
    setUploadingFiles(true);
    try {
      await Promise.all(newFiles.map((file) => documentsApi.upload(parseInt(id!), file)));
      toast.success('Files uploaded successfully');
      setNewFiles([]);
      loadTicket();
    } catch {
      toast.error('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appealText.trim().length < 20) return;
    setSubmittingAppeal(true);
    try {
      await ticketsApi.appeal(parseInt(id!), appealText.trim());
      toast.success('Your appeal has been submitted.');
      setShowAppealModal(false);
      setAppealText('');
      loadTicket();
    } catch {
      toast.error('Failed to submit appeal. Please try again.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!ticket) return null;

  const canUploadMore = !['approved', 'rejected'].includes(ticket.status);

  const aiStatusStyles: Record<string, string> = {
    approved: 'bg-emerald-500/10 border-emerald-500/30',
    rejected: 'bg-rose-500/10 border-rose-500/30',
    pending_info: 'bg-orange-500/10 border-orange-500/30',
    default: 'bg-sky-500/10 border-sky-500/30',
  };
  const aiTextStyles: Record<string, string> = { approved: 'text-emerald-300', rejected: 'text-rose-300', pending_info: 'text-orange-300', default: 'text-sky-300' };

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="flex items-center text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors">
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Dashboard
      </button>

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

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-500">Incident Type</h3>
            <p className="mt-1 text-sm text-slate-200 capitalize">{ticket.incident_type.replace('_', ' ')}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500">Incident Date</h3>
            <p className="mt-1 text-sm text-slate-200">{format(new Date(ticket.incident_date), 'MMMM d, yyyy')}</p>
          </div>
          {ticket.incident_location && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Location</h3>
              <p className="mt-1 text-sm text-slate-200">{ticket.incident_location}</p>
            </div>
          )}
          {ticket.claim_amount && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Claimed Amount</h3>
              <p className="mt-1 text-sm text-slate-200">${Number(ticket.claim_amount).toLocaleString()}</p>
            </div>
          )}
          {ticket.approved_amount != null && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Approved Payout</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-400">${Number(ticket.approved_amount).toLocaleString()}</p>
            </div>
          )}
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-slate-500">Description</h3>
            <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>

        {ticket.ai_analysis && ['approved', 'rejected', 'pending_info'].includes(ticket.status) && (() => {
          const latestReason = ticket.status_history?.[0]?.reason || '';
          const customerMessages: Record<string, string> = {
            approved: 'Your claim has been reviewed and approved. If a payout amount has been set, it is shown above.',
            rejected: 'Your claim has been reviewed and we were unable to approve it at this time.',
            pending_info: 'We need some additional information before we can continue processing your claim.',
          };
          const heading: Record<string, string> = {
            approved: 'Claim Approved',
            rejected: 'Claim Not Approved',
            pending_info: 'Additional Information Required',
          };
          return (
            <div className={`px-6 py-4 border-t border-slate-700 ${aiStatusStyles[ticket.status as keyof typeof aiStatusStyles] || aiStatusStyles.default}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  {ticket.status === 'approved' ? <CheckCircleIcon className="h-6 w-6 text-emerald-400" /> :
                   ticket.status === 'rejected' ? <XCircleIcon className="h-6 w-6 text-rose-400" /> :
                   <ExclamationTriangleIcon className="h-6 w-6 text-orange-400" />}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${aiTextStyles[ticket.status as keyof typeof aiTextStyles] || aiTextStyles.default}`}>
                    {heading[ticket.status] || ticket.status}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {latestReason || customerMessages[ticket.status]}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {!ticket.ai_analysis && ['submitted', 'processing'].includes(ticket.status) && (
          <>
            <div className="px-6 py-4 border-t border-slate-700 bg-sky-500/10">
              <div className="flex items-center">
                <CpuChipIcon className="h-6 w-6 text-sky-400 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-sky-300">AI Analysis in Progress</h3>
                  <p className="text-sm text-slate-400">Our AI is analyzing your documents. This usually takes a few moments.</p>
                </div>
              </div>
            </div>
            <LiveStatusTracker
              ticketId={ticket.id}
              onStatusChange={() => loadTicket()}
            />
          </>
        )}

        {ticket.documents && ticket.documents.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Documents</h3>
            <ul className="divide-y divide-slate-700 border border-slate-700 rounded-xl overflow-hidden">
              {ticket.documents.map((doc) => (
                <li key={doc.id} className="flex items-center py-3 px-4 bg-slate-800/30">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    doc.file_type === 'pdf' ? 'bg-rose-500/20 text-rose-400' :
                    doc.file_type === 'video' ? 'bg-violet-500/20 text-violet-400' :
                    'bg-sky-500/20 text-sky-400'
                  }`}>
                    {doc.file_type === 'pdf' ? <DocumentTextIcon className="h-5 w-5" /> :
                     doc.file_type === 'video' ? <FilmIcon className="h-5 w-5" /> :
                     <PhotoIcon className="h-5 w-5" />}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-slate-200">{doc.original_filename}</p>
                    <p className="text-xs text-slate-500">Uploaded {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</p>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
                    View
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canUploadMore && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Upload Additional Documents</h3>
            <FileUpload files={newFiles} onFilesChange={setNewFiles} disabled={uploadingFiles} />
            {newFiles.length > 0 && (
              <div className="mt-4">
                <button onClick={handleUploadFiles} disabled={uploadingFiles} className="btn-primary">
                  {uploadingFiles ? <><LoadingSpinner size="sm" /><span className="ml-2">Uploading...</span></> : 'Upload Files'}
                </button>
              </div>
            )}
          </div>
        )}

        {ticket.notes && ticket.notes.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Notes & Updates</h3>
            <div className="space-y-4">
              {ticket.notes.map((note) => (
                <div key={note.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-200">{note.author_name}</span>
                    <span className="text-xs text-slate-500">{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ticket.status === 'pending_info' && (
          <div className="px-6 py-4 border-t border-slate-700 bg-orange-500/10">
            <h3 className="text-sm font-medium text-orange-400 mb-3">Action Required: Additional Information Needed</h3>
            <form onSubmit={handleRespond}>
              <textarea rows={4} className="input px-3 py-2" placeholder="Provide the requested information..." value={responseText} onChange={(e) => setResponseText(e.target.value)} />
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={submitting || !responseText.trim()} className="btn-primary">
                  {submitting ? <><LoadingSpinner size="sm" /><span className="ml-2">Submitting...</span></> : 'Submit Response'}
                </button>
              </div>
            </form>
          </div>
        )}

        {ticket.status === 'rejected' && (
          <div className="px-6 py-4 border-t border-slate-700 bg-rose-500/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-rose-400">Disagree with this decision?</h3>
                <p className="text-sm text-slate-400 mt-1">
                  You can appeal if you believe this decision was made in error or if you have additional evidence to support your claim.
                </p>
              </div>
              <button
                onClick={() => setShowAppealModal(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Appeal Decision
              </button>
            </div>
          </div>
        )}

        {ticket.status === 'appealed' && (
          <div className="px-6 py-4 border-t border-slate-700 bg-violet-500/10">
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="h-5 w-5 text-violet-400 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-violet-300">Appeal Under Review</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Your appeal has been received and is being reviewed by our claims team. We'll notify you once a decision has been made.
                </p>
              </div>
            </div>
          </div>
        )}

        {ticket.status_history && ticket.status_history.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Status History</h3>
            <ul className="-mb-8">
              {ticket.status_history.map((history, idx) => (
                <li key={history.id}>
                  <div className="relative pb-8">
                    {idx !== ticket.status_history!.length - 1 && <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-700" />}
                    <div className="relative flex space-x-3">
                      <span className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <ClockIcon className="h-4 w-4 text-slate-500" />
                      </span>
                      <div className="flex min-w-0 flex-1 justify-between pt-1.5">
                        <div>
                          <StatusBadge status={history.new_status as TicketStatus} />
                          {history.reason && <p className="text-sm text-slate-300 mt-1.5">{history.reason}</p>}
                        </div>
                        <span className="text-sm text-slate-500">{format(new Date(history.changed_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Appeal modal */}
      {showAppealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowPathIcon className="h-5 w-5 text-violet-400" />
                <h2 className="text-base font-semibold text-slate-100">Appeal Decision</h2>
              </div>
              <button
                onClick={() => { setShowAppealModal(false); setAppealText(''); }}
                className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAppeal} className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-400">
                Explain why you believe this decision should be reconsidered. Provide as much detail as possible, including any additional evidence or circumstances not previously submitted.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Grounds for Appeal <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={5}
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Describe why you believe this claim should be reconsidered..."
                  className="block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none text-sm resize-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Minimum 20 characters — {appealText.trim().length} entered
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAppealModal(false); setAppealText(''); }}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAppeal || appealText.trim().length < 20}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {submittingAppeal ? <><LoadingSpinner size="sm" /><span>Submitting...</span></> : 'Submit Appeal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
