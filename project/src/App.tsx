
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';


import { AddPrescription } from './pages/AddPrescription';
import Dashboard from './pages/Dashboard';
import './global.css';
import Signup from './pages/SignUp';
import Home from './pages/landing';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup/>} />
        <Route path="/" element={<Home/>} />       
        <Route path="/prescription" element={<AddPrescription />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;