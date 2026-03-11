import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ticketsApi, documentsApi } from '../../services/api';
import type { Ticket } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import FileUpload from '../../components/FileUpload';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  PhotoIcon,
  ClockIcon,
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
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
              <h3 className="text-sm font-medium text-slate-500">Claim Amount</h3>
              <p className="mt-1 text-sm text-slate-200">${ticket.claim_amount.toLocaleString()}</p>
            </div>
          )}
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-slate-500">Description</h3>
            <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>

        {ticket.ai_analysis && (
          <div className={`px-6 py-4 border-t border-slate-700 ${aiStatusStyles[ticket.status as keyof typeof aiStatusStyles] || aiStatusStyles.default}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                {ticket.status === 'approved' ? <CheckCircleIcon className="h-6 w-6 text-emerald-400" /> :
                 ticket.status === 'rejected' ? <XCircleIcon className="h-6 w-6 text-rose-400" /> :
                 ticket.status === 'pending_info' ? <ExclamationTriangleIcon className="h-6 w-6 text-orange-400" /> :
                 <CpuChipIcon className="h-6 w-6 text-sky-400" />}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${aiTextStyles[ticket.status as keyof typeof aiTextStyles] || aiTextStyles.default}`}>
                  {ticket.status === 'approved' ? 'Claim Approved' : ticket.status === 'rejected' ? 'Claim Rejected' :
                   ticket.status === 'pending_info' ? 'Additional Information Required' : 'AI Processing'}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  {ticket.ai_analysis.analysis_summary || 'Your claim is being analyzed by our AI system.'}
                </p>
                {ticket.ai_analysis.confidence_score > 0 && (
                  <p className="mt-1 text-xs text-slate-500">Confidence: {(ticket.ai_analysis.confidence_score * 100).toFixed(0)}%</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!ticket.ai_analysis && ['submitted', 'processing'].includes(ticket.status) && (
          <div className="px-6 py-4 border-t border-slate-700 bg-sky-500/10">
            <div className="flex items-center">
              <CpuChipIcon className="h-6 w-6 text-sky-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-sky-300">AI Analysis in Progress</h3>
                <p className="text-sm text-slate-400">Our AI is analyzing your documents. This usually takes a few moments.</p>
              </div>
            </div>
          </div>
        )}

        {ticket.documents && ticket.documents.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <h3 className="text-sm font-medium text-slate-200 mb-3">Documents</h3>
            <ul className="divide-y divide-slate-700 border border-slate-700 rounded-xl overflow-hidden">
              {ticket.documents.map((doc) => (
                <li key={doc.id} className="flex items-center py-3 px-4 bg-slate-800/30">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${doc.file_type === 'pdf' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'}`}>
                    {doc.file_type === 'pdf' ? <DocumentTextIcon className="h-5 w-5" /> : <PhotoIcon className="h-5 w-5" />}
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
                          <p className="text-sm text-slate-400">
                            Status changed to <span className="font-medium text-slate-200">{history.new_status}</span>
                            {history.reason && <span className="block text-slate-500 mt-1">{history.reason}</span>}
                          </p>
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
    </div>
  );
}
