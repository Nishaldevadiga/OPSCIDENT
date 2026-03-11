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

export default function TicketCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    incident_type: '' as IncidentType | '',
    title: '',
    description: '',
    incident_date: '',
    incident_location: '',
    claim_amount: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.incident_type) {
      toast.error('Please select an incident type');
      return;
    }

    if (files.length === 0) {
      toast.error('Please upload at least one document');
      return;
    }

    setLoading(true);

    try {
      const ticketData = {
        ...formData,
        incident_type: formData.incident_type as IncidentType,
        claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : undefined,
      };

      const ticket = await ticketsApi.create(ticketData);

      const uploadPromises = files.map((file) =>
        documentsApi.upload(ticket.id, file)
      );
      await Promise.all(uploadPromises);

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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50">Submit New Claim</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fill out the form below to submit a new insurance claim
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-medium text-slate-100 mb-4">Incident Information</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-slate-300">Claim Title *</label>
              <input type="text" name="title" id="title" required className="mt-1 input px-3 py-2" placeholder="Brief description of your claim" value={formData.title} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="incident_type" className="block text-sm font-medium text-slate-300">Incident Type *</label>
              <select id="incident_type" name="incident_type" required className="mt-1 input px-3 py-2" value={formData.incident_type} onChange={handleChange}>
                <option value="">Select type</option>
                {incidentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="incident_date" className="block text-sm font-medium text-slate-300">Incident Date *</label>
              <input type="date" name="incident_date" id="incident_date" required className="mt-1 input px-3 py-2" value={formData.incident_date} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="incident_location" className="block text-sm font-medium text-slate-300">Incident Location</label>
              <input type="text" name="incident_location" id="incident_location" className="mt-1 input px-3 py-2" placeholder="Address or location" value={formData.incident_location} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="claim_amount" className="block text-sm font-medium text-slate-300">Estimated Claim Amount ($)</label>
              <input type="number" name="claim_amount" id="claim_amount" min="0" step="0.01" className="mt-1 input px-3 py-2" placeholder="0.00" value={formData.claim_amount} onChange={handleChange} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-slate-300">Description *</label>
              <textarea id="description" name="description" rows={4} required className="mt-1 input px-3 py-2" placeholder="Provide a detailed description of the incident..." value={formData.description} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-medium text-slate-100 mb-4">Supporting Documents</h2>
          <p className="text-sm text-slate-400 mb-4">
            Upload photos of the damage and any relevant documents (police reports, medical records, etc.)
          </p>
          <FileUpload files={files} onFilesChange={setFiles} disabled={loading} />
        </div>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Submitting...</span>
              </>
            ) : (
              'Submit Claim'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
