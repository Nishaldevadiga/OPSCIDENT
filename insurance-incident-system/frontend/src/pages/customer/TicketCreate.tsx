import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ticketsApi, documentsApi } from '../../services/api';
import type { IncidentType } from '../../types';
import FileUpload from '../../components/FileUpload';
import LoadingSpinner from '../../components/LoadingSpinner';

const incidentTypes: { value: IncidentType; label: string }[] = [
  { value: 'vehicle_collision', label: 'Vehicle Collision' },
  { value: 'vehicle_theft', label: 'Vehicle Theft' },
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'natural_disaster', label: 'Natural Disaster' },
  { value: 'personal_injury', label: 'Personal Injury' },
  { value: 'other', label: 'Other' },
];

type FormData = {
  incident_type: IncidentType | '';
  title: string;
  description: string;
  incident_date: string;
  incident_location: string;
  claim_amount: string;
};

const emptyForm: FormData = {
  incident_type: '',
  title: '',
  description: '',
  incident_date: '',
  incident_location: '',
  claim_amount: '',
};

function AutoTag() {
  return (
    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-500/15 text-primary-400 border border-primary-500/20">
      auto
    </span>
  );
}

export default function TicketCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setAutoFilledFields((prev) => { const s = new Set(prev); s.delete(name); return s; });
  };

  const handleFilesChange = async (newFiles: File[]) => {
    setFiles(newFiles);

    const firstNew = newFiles.find((f) => !files.includes(f));
    if (!firstNew) return;

    const supported = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!supported.includes(firstNew.type)) return;

    setExtracting(true);
    try {
      const extracted = await documentsApi.extractFields(firstNew);

      if (extracted.error || !extracted.confidence || extracted.confidence < 0.2) return;

      const filled = new Set<string>();
      setFormData((prev) => {
        const next = { ...prev };
        if (extracted.incident_type && !prev.incident_type) { next.incident_type = extracted.incident_type as IncidentType; filled.add('incident_type'); }
        if (extracted.title && !prev.title) { next.title = extracted.title; filled.add('title'); }
        if (extracted.description && !prev.description) { next.description = extracted.description; filled.add('description'); }
        if (extracted.incident_date && !prev.incident_date) { next.incident_date = extracted.incident_date; filled.add('incident_date'); }
        if (extracted.incident_location && !prev.incident_location) { next.incident_location = extracted.incident_location; filled.add('incident_location'); }
        if (extracted.claim_amount != null && !prev.claim_amount) { next.claim_amount = String(extracted.claim_amount); filled.add('claim_amount'); }
        return next;
      });

      if (filled.size > 0) {
        setAutoFilledFields(filled);
        toast.success(`${filled.size} field${filled.size > 1 ? 's' : ''} auto-filled from document`, { icon: '✨', duration: 4000 });
      }
    } catch {
      // Non-blocking — user can still fill manually
    } finally {
      setExtracting(false);
    }
  };

  const hasImage = files.some((f) => f.type.startsWith('image/'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.incident_type) { toast.error('Please select an incident type'); return; }
    if (!hasImage) { toast.error('At least one image of the damage is required'); return; }

    setLoading(true);
    try {
      const ticketData = {
        ...formData,
        incident_type: formData.incident_type as IncidentType,
        claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : undefined,
      };
      const ticket = await ticketsApi.create(ticketData);
      await Promise.all(files.map((file) => documentsApi.upload(ticket.id, file)));
      toast.success(`Claim created! Ticket ID: ${ticket.ticket_id}`);
      navigate(`/tickets/${ticket.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: Record<string, string[]> } };
      const errorData = err.response?.data;
      if (errorData) {
        const firstError = Object.values(errorData)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else {
        toast.error('Failed to create claim. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name: string) =>
    `mt-1 input px-3 py-2 transition-colors ${autoFilledFields.has(name) ? 'border-primary-500/60 bg-primary-500/5' : ''}`;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50">Submit New Claim</h1>
        <p className="mt-1 text-sm text-slate-400">Upload your document first — fields will be auto-filled using AI</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Documents first so OCR runs before user fills form */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium text-slate-100">Supporting Documents</h2>
            {extracting && (
              <span className="inline-flex items-center gap-1.5 text-xs text-primary-400 animate-pulse">
                <LoadingSpinner size="sm" />
                Reading document...
              </span>
            )}
          </div>
          <div className="flex items-start gap-2 mb-4">
            <p className="text-sm text-slate-400">
              <span className="text-rose-400 font-medium">At least one damage photo is required.</span>{' '}
              You may also attach police reports, receipts, or other PDFs as supporting documents.
            </p>
          </div>
          <FileUpload files={files} onFilesChange={handleFilesChange} disabled={loading} />
          {files.length > 0 && !hasImage && (
            <p className="mt-2 text-xs text-rose-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Please add at least one image (JPEG or PNG) showing the damage.
            </p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-100">Incident Information</h2>
            {autoFilledFields.size > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-400 border border-primary-500/20 bg-primary-500/10 px-2 py-1 rounded-full">
                ✨ {autoFilledFields.size} auto-filled — review before submitting
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-slate-300">
                Claim Title * {autoFilledFields.has('title') && <AutoTag />}
              </label>
              <input type="text" name="title" id="title" required className={inputClass('title')} placeholder="Brief description of your claim" value={formData.title} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="incident_type" className="block text-sm font-medium text-slate-300">
                Incident Type * {autoFilledFields.has('incident_type') && <AutoTag />}
              </label>
              <select id="incident_type" name="incident_type" required className={inputClass('incident_type')} value={formData.incident_type} onChange={handleChange}>
                <option value="">Select type</option>
                {incidentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="incident_date" className="block text-sm font-medium text-slate-300">
                Incident Date * {autoFilledFields.has('incident_date') && <AutoTag />}
              </label>
              <input type="date" name="incident_date" id="incident_date" required className={inputClass('incident_date')} value={formData.incident_date} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="incident_location" className="block text-sm font-medium text-slate-300">
                Incident Location {autoFilledFields.has('incident_location') && <AutoTag />}
              </label>
              <input type="text" name="incident_location" id="incident_location" className={inputClass('incident_location')} placeholder="Address or location" value={formData.incident_location} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="claim_amount" className="block text-sm font-medium text-slate-300">
                Estimated Claim Amount ($) {autoFilledFields.has('claim_amount') && <AutoTag />}
              </label>
              <input type="number" name="claim_amount" id="claim_amount" min="0" step="0.01" className={inputClass('claim_amount')} placeholder="0.00" value={formData.claim_amount} onChange={handleChange} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-slate-300">
                Description * {autoFilledFields.has('description') && <AutoTag />}
              </label>
              <textarea id="description" name="description" rows={4} required className={inputClass('description')} placeholder="Provide a detailed description of the incident..." value={formData.description} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary" disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading || extracting || !hasImage}>
            {loading ? <><LoadingSpinner size="sm" /><span className="ml-2">Submitting...</span></> : 'Submit Claim'}
          </button>
        </div>
      </form>
    </div>
  );
}
