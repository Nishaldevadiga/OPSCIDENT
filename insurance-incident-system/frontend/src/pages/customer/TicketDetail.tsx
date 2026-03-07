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
    if (id) {
      loadTicket();
    }
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
    } catch (error) {
      toast.error('Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFiles = async () => {
    if (newFiles.length === 0) return;

    setUploadingFiles(true);
    try {
      const uploadPromises = newFiles.map((file) =>
        documentsApi.upload(parseInt(id!), file)
      );
      await Promise.all(uploadPromises);
      toast.success('Files uploaded successfully');
      setNewFiles([]);
      loadTicket();
    } catch (error) {
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

  if (!ticket) {
    return null;
  }

  const canUploadMore = !['approved', 'rejected'].includes(ticket.status);

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Dashboard
      </button>

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

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6">
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
          {ticket.incident_location && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Location</h3>
              <p className="mt-1 text-sm text-gray-900">{ticket.incident_location}</p>
            </div>
          )}
          {ticket.claim_amount && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Claim Amount</h3>
              <p className="mt-1 text-sm text-gray-900">
                ${ticket.claim_amount.toLocaleString()}
              </p>
            </div>
          )}
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500">Description</h3>
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>
        </div>

        {ticket.documents && ticket.documents.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Documents</h3>
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
              {ticket.documents.map((doc) => (
                <li key={doc.id} className="flex items-center py-3 px-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded flex items-center justify-center ${
                    doc.file_type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {doc.file_type === 'pdf' ? (
                      <DocumentTextIcon className="h-5 w-5" />
                    ) : (
                      <PhotoIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{doc.original_filename}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canUploadMore && (
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Additional Documents</h3>
            <FileUpload files={newFiles} onFilesChange={setNewFiles} disabled={uploadingFiles} />
            {newFiles.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={handleUploadFiles}
                  disabled={uploadingFiles}
                  className="btn-primary"
                >
                  {uploadingFiles ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Uploading...</span>
                    </>
                  ) : (
                    'Upload Files'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {ticket.notes && ticket.notes.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Notes & Updates</h3>
            <div className="space-y-4">
              {ticket.notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {note.author_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ticket.status === 'pending_info' && (
          <div className="px-6 py-4 border-t border-gray-200 bg-orange-50">
            <h3 className="text-sm font-medium text-orange-800 mb-3">
              Action Required: Additional Information Needed
            </h3>
            <form onSubmit={handleRespond}>
              <textarea
                rows={4}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                placeholder="Provide the requested information..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !responseText.trim()}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Submitting...</span>
                    </>
                  ) : (
                    'Submit Response'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {ticket.status_history && ticket.status_history.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Status History</h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {ticket.status_history.map((history, idx) => (
                  <li key={history.id}>
                    <div className="relative pb-8">
                      {idx !== ticket.status_history!.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <ClockIcon className="h-4 w-4 text-gray-500" />
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-500">
                              Status changed to{' '}
                              <span className="font-medium text-gray-900">
                                {history.new_status}
                              </span>
                              {history.reason && (
                                <span className="block text-gray-500 mt-1">
                                  {history.reason}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {format(new Date(history.changed_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
