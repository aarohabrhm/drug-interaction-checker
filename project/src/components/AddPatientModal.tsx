import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import type { PatientFormData } from '../lib/types';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (patient: PatientFormData) => void;
}

export default function AddPatientModal({ onClose, onSubmit }: AddPatientModalProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    disease: '',
    currentMedications: [],
  });
  const [newMedication, setNewMedication] = useState('');

  const handleAddMedication = () => {
    if (newMedication.trim()) {
      setFormData(prev => ({
        ...prev,
        currentMedications: [...prev.currentMedications, newMedication.trim()]
      }));
      setNewMedication('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Patient</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Name
            </label>
            <Input
              required
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chronic Disease
            </label>
            <Input
              required
              value={formData.disease}
              onChange={e => setFormData(prev => ({ ...prev, disease: e.target.value }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Medications
            </label>
            <div className="flex gap-2">
              <Input
                value={newMedication}
                onChange={e => setNewMedication(e.target.value)}
                placeholder="Enter medication"
                className="flex-1"
              />
              <Button type="button" onClick={handleAddMedication}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {formData.currentMedications.length > 0 && (
              <div className="mt-2 space-y-1">
                {formData.currentMedications.map((med, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span>{med}</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        currentMedications: prev.currentMedications.filter((_, i) => i !== index)
                      }))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add Patient
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}