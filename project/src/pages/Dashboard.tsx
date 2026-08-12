import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, PlusCircle, Search, UserRound } from 'lucide-react';
import {
  Patient,
  addPatient,
  fetchDoctorDetails,
  fetchPatients,
  logoutDoctor,
} from '../../utils/api';
import { useDocumentMeta } from '../lib/useDocumentMeta';

function PatientList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();

  useDocumentMeta(
    'SafeMeds | Patients',
    'SafeMeds doctor prescription platform with drug interaction checking'
  );

  const [newPatient, setNewPatient] = useState({
    name: '',
    age: '',
    medical_condition: '',
    remarks: '',
    phone_number: '',
    email: '',
    current_medications: ''
  });

  const [doctor, setDoctor] = useState<{ name: string; specialty: string }>({
    name: '',
    specialty: '',
  });

  // Searching happens server-side now: the patient list is paginated, so
  // filtering the current page in the browser would silently miss matches on
  // every other page.
  const loadPatients = useCallback(async (search: string) => {
    try {
      setLoading(true);
      const page = await fetchPatients({ search });
      setPatients(page.patients);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPatients(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadPatients]);

  useEffect(() => {
    const loadDoctor = async () => {
      try {
        // Previously read localStorage key "token" while login wrote
        // "authToken", so this never ran and the header showed a hardcoded
        // placeholder doctor. The token is now attached by the API client.
        const doctorData = await fetchDoctorDetails();
        if (doctorData) {
          setDoctor({
            name: doctorData.username,
            specialty: doctorData.specialty || 'Not Specified',
          });
        }
      } catch {
        // Non-fatal: the patient list is still usable without the profile.
      }
    };
    void loadDoctor();
  }, []);

  const handleLogout = async () => {
    await logoutDoctor();
    navigate('/login', { replace: true });
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const savedPatient = await addPatient({
        ...newPatient,
        age: newPatient.age ? parseInt(newPatient.age, 10) : null,
      });

      setPatients((prevPatients) => [savedPatient, ...prevPatients]);
      setIsAddModalOpen(false);

      setNewPatient({
        name: '',
        age: '',
        medical_condition: '',
        remarks: '',
        phone_number: '',
        email: '',
        current_medications: '',
      });
    } catch (err) {
      // Surface the API's validation message instead of a generic string.
      setFormError(err instanceof Error ? err.message : 'Failed to add patient.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-transparent">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="text-blue-400 mr-2">
              <img
                src="/logo.png"
                alt=""
                className="w-10 h-10"
              />
            </div>
            <h1 className="text-xl font-bold">SafeMeds</h1>
          </div>

          <div className="flex items-center gap-4">
            {doctor.name && (
              <span className="text-sm text-gray-600">
                {doctor.name}
                {doctor.specialty ? ` · ${doctor.specialty}` : ''}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="border border-gray-400 text-gray-800 hover:bg-blue-600 hover:text-white rounded-full px-5 py-2 items-center shadow-lg">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-2">
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Patient List</h2>
            <div className="flex space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full bg-gray-100 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 flex items-center shadow-sm"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                Add Patient
              </button>
              <button onClick={() => navigate('/prescription')} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 flex items-center shadow-sm">
                <PlusCircle className="h-5 w-5 mr-2" />
                Add Prescription
              </button>
              <button
                onClick={() => navigate('/prescriptions')}
                className="border border-gray-400 text-gray-800 hover:bg-gray-200 rounded-full px-4 py-2 flex items-center shadow-sm"
              >
                <FileText className="h-5 w-5 mr-2" />
                History
              </button>
            </div>
          </div>

          {/* Add Patient Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-200 rounded-2xl shadow-lg p-6 max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Add New Patient</h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleAddPatient}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Name</label>
                      <input
                        type="text"
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.name}
                        onChange={(e) => setNewPatient({...newPatient, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Age</label>
                      <input
                        type="number"
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.age}
                        onChange={(e) => setNewPatient({...newPatient, age: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Phone Number</label>
                      <input
                        type="tel"
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.phone_number}
                        onChange={(e) => setNewPatient({...newPatient, phone_number: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <input
                        type="email"
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.email}
                        onChange={(e) => setNewPatient({...newPatient, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-gray-500">Medical Condition</label>
                      <textarea
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.medical_condition}
                        onChange={(e) => setNewPatient({...newPatient, medical_condition: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-gray-500">Current Medications (comma-separated)</label>
                      <textarea
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.current_medications}
                        onChange={(e) => setNewPatient({...newPatient, current_medications: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-gray-500">Remarks (optional)</label>
                      <textarea
                        className="w-full p-2 mt-1 border rounded-lg"
                        value={newPatient.remarks}
                        onChange={(e) => setNewPatient({...newPatient, remarks: e.target.value})}
                      />
                    </div>
                  </div>
                  {formError && (
                    <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                      {formError}
                    </div>
                  )}
                  <div className="flex space-x-2 mt-6">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg px-4 py-2 flex-1"
                    >
                      {saving ? 'Saving…' : 'Add Patient'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setFormError(null);
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Selected Patient Modal */}
          {selectedPatient && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-gray-200 rounded-2xl shadow-lg p-6 max-w-lg w-full max-h-screen overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Patient Details</h3>
                  <button onClick={() => setSelectedPatient(null)} className="text-gray-500 hover:text-gray-700">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center text-white overflow-hidden mr-4">
                    <UserRound className='h-10 w-10'/>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{selectedPatient.name}</h4>
                    <p className="text-sm text-gray-500">ID: {selectedPatient.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Registered Date</p>
                    <p className="font-medium">{new Date(selectedPatient.registered_date).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="font-medium">{selectedPatient.age}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{selectedPatient.phone_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{selectedPatient.email}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <h5 className="font-semibold mb-2">Medical Condition</h5>
                  <p className="text-sm">{selectedPatient.medical_condition}</p>
                </div>
                <div className="mb-4">
                  <h5 className="font-semibold mb-2">Current Medications</h5>
                  <ul className="list-disc pl-5">
                    {selectedPatient.current_medications.split(',').map((med, i) => (
                      <li key={i} className="text-sm">{med.trim()}</li>
                    ))}
                  </ul>
                </div>
                <div className="mb-4">
                  <h5 className="font-semibold mb-2">Remarks</h5>
                  <p className="text-sm">{selectedPatient.remarks || 'None'}</p>
                </div>
                <div className="flex space-x-2 mt-6">
                  <button onClick={() => navigate('/prescription')} className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 flex-1">
                    Add Prescription
                  </button>
                  <button onClick={() => setSelectedPatient(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg px-4 py-2 flex-1">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-4">Loading patients...</div>
          )}
          {error && (
            <div className="text-center py-4 text-red-500">{error}</div>
          )}
          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {patients.map((patient) => (
                <div 
                  key={patient.id} 
                  className="bg-gray-50 border-2 border-white rounded-2xl shadow-sm overflow-hidden cursor-pointer" 
                  onClick={() => setSelectedPatient(patient)}
                >
                  <div className="p-4">
                    <div className="flex items-center mb-3">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-white overflow-hidden mr-2">
                        <UserRound className='h-5 w-5'/>
                      </div>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>
                        <p className="text-gray-500 pb-1">Registered:</p>
                        <p>{new Date(patient.registered_date).toLocaleDateString('en-GB')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 pb-1">Phone:</p>
                        <p>{patient.phone_number}</p>
                      </div>
                      <div className="mt-1">
                        <p className="text-gray-500 pb-1">Email:</p>
                        <p>{patient.email}</p>
                      </div>
                      <div className="mt-1">
                        <p className="text-gray-500 pb-1">Age:</p>
                        <p>{patient.age}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Medication</p>
                      <ul className="list-none flex flex-wrap gap-1">
                        {patient.current_medications?.split(',').map((med, i) => (
                          <li key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {med.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default PatientList;