// pages/index.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate(); 

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <Head>
        <title>SafeMeds | Prescription Management for Doctors</title>
        <meta name="description" content="Intelligent prescription management with drug interaction checking" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-black flex items-center">
              <img 
                src="/logo.png" 
                alt="DNA illustration" 
                className="w-10 h-10"
              />
                SafeMeds
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors">How It Works</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors">Testimonials</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/login')} className="px-4 py-2 text-blue-600 font-medium hover:text-blue-700 transition-colors">Log in</button>
              <button onClick={() => navigate('/signup')} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Sign up</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section 
        className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <motion.div variants={fadeInUp}>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 ">
                Ensure Prescription Safety with  <span className="text-blue-400">SafeMeds</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600">
              An intelligent prescription management system with advanced drug interaction checking to help doctors provide safer, more efficient care.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button onClick={() => navigate('/signup')} className="px-8 py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700  shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all">
                Learn More
              </button>
              
            </div>
          </motion.div>
          <motion.div
            variants={fadeInUp}
            className="relative"
          >
            <div className="pl-2">
            <img 
                src="/model.png" 
                alt="Doctor" 
                className="w-full h-auto rounded-2xl"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-400 rounded-full filter blur-3xl opacity-20 z-0"></div>
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-blue-400 rounded-full filter blur-3xl opacity-20 z-0"></div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-gray-800">
            Powerful Features for Modern Healthcare
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to manage prescriptions efficiently and safely
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11H15M12 8V14M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Patient Management</h3>
            <p className="text-gray-600">
              Easily add, update, and manage patient profiles with complete medical history, allergies, and current medications.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Drug Interaction Checking</h3>
            <p className="text-gray-600">
              Advanced algorithms detect potential drug interactions, contraindications, and dosage issues before prescriptions are finalized.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 16L8 12M12 8L8 12M8 12L12 16M16 16H20M17 20V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">PDF Export</h3>
            <p className="text-gray-600">
              Generate professional, compliant prescription PDFs with customizable templates that can be directly printed or sent electronically.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.4 15C19.1277 15.6171 19.1277 16.3246 19.4 16.9417C19.6723 17.5589 20.1895 18.0512 20.8211 18.2918C21.4526 18.5324 22.1545 18.5098 22.769 18.2293C23.3836 17.9488 23.8683 17.4326 24.1 16.8C24.3317 16.1674 24.2996 15.4658 24.01 14.8586C23.7204 14.2515 23.2014 13.7779 22.569 13.55C21.9366 13.3221 21.2389 13.3606 20.637 13.6568C20.035 13.953 19.5814 14.4829 19.4 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 15C1.72769 15.6171 1.72769 16.3246 2 16.9417C2.27231 17.5589 2.78952 18.0512 3.42108 18.2918C4.05264 18.5324 4.75447 18.5098 5.36905 18.2293C5.98362 17.9488 6.46828 17.4326 6.7 16.8C6.93172 16.1674 6.89965 15.4658 6.61005 14.8586C6.32045 14.2515 5.80139 13.7779 5.16899 13.55C4.5366 13.3221 3.83886 13.3606 3.23703 13.6568C2.6352 13.953 2.18164 14.4829 2 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6C12.6171 5.72769 13.3246 5.72769 13.9417 6C14.5589 6.27231 15.0512 6.78952 15.2918 7.42108C15.5324 8.05264 15.5098 8.75447 15.2293 9.36905C14.9488 9.98362 14.4326 10.4683 13.8 10.7C13.1674 10.9317 12.4658 10.8996 11.8586 10.61C11.2515 10.3205 10.7779 9.80139 10.55 9.16899C10.3221 8.5366 10.3606 7.83886 10.6568 7.23703C10.953 6.6352 11.4829 6.18164 12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Medication Database</h3>
            <p className="text-gray-600">
              Access a comprehensive, regularly updated database of medications, including dosing guidelines and common side effects.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 4V7M12 17V20M4.93 7.93L7.05 10.05M16.95 16.95L19.07 19.07M4 12H7M17 12H20M4.93 16.07L7.05 13.95M16.95 7.05L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Clinical Decision Support</h3>
            <p className="text-gray-600">
              Get intelligent recommendations based on patient history, lab results, and best-practice guidelines to support clinical decisions.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/30 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 group hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 6C12.6171 5.72769 13.3246 5.72769 13.9417 6C14.5589 6.27231 15.0512 6.78952 15.2918 7.42108C15.5324 8.05264 15.5098 8.75447 15.2293 9.36905C14.9488 9.98362 14.4326 10.4683 13.8 10.7C13.1674 10.9317 12.4658 10.8996 11.8586 10.61C11.2515 10.3205 10.7779 9.80139 10.55 9.16899C10.3221 8.5366 10.3606 7.83886 10.6568 7.23703C10.953 6.6352 11.4829 6.18164 12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Audit & Compliance</h3>
            <p className="text-gray-600">
              Maintain detailed prescription history with built-in audit trails to help meet regulatory requirements and support best practices.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-gray-800">
            How SafeMeds Works
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            A simple four-step process to streamline your prescription workflow
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg transition-all border border-white/20 relative"
          >
            <div className="absolute -top-5 -left-5 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-4">Patient Selection</h3>
            <p className="text-gray-600">
              Search for existing patients or add new ones with complete medical profiles and history.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg transition-all border border-white/20 relative"
          >
            <div className="absolute -top-5 -left-5 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-4">Create Prescription</h3>
            <p className="text-gray-600">
              Select medications from our database with smart autocomplete and customizable dosing instructions.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg transition-all border border-white/20 relative"
          >
            <div className="absolute -top-5 -left-5 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-4">Safety Check</h3>
            <p className="text-gray-600">
              Our system automatically checks for drug interactions, allergies, and dosing issues in real-time.
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg transition-all border border-white/20 relative"
          >
            <div className="absolute -top-5 -left-5 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-4">Generate & Send</h3>
            <p className="text-gray-600">
              Export prescriptions as professional PDFs for printing or direct electronic transfer to pharmacies.
            </p>
          </motion.div>
        </motion.div>

        <motion.div 
          className="mt-16 flex justify-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <a href="#" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700  shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all">
            Schedule Demo
          </a>
        </motion.div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-gray-800">
            Trusted by Healthcare Professionals
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            See what doctors are saying about SafeMeds's impact on their practice
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Dr. Sarah Johnson</h4>
                <p className="text-gray-500 text-sm">Cardiologist</p>
              </div>
            </div>
            <p className="text-gray-600">
              "SafeMeds has transformed my prescription workflow. The drug interaction checking has caught several potential issues that could have been problematic for my cardiac patients."
            </p>
            <div className="mt-4 flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Dr. Michael Chen</h4>
                <p className="text-gray-500 text-sm">Family Medicine</p>
              </div>
            </div>
            <p className="text-gray-600">
              "The PDF export feature saves me so much time. My patients appreciate the clear, professional prescriptions, and my staff loves the streamlined workflow."
            </p>
            <div className="mt-4 flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20"
          >
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Dr. Amanda Rodriguez</h4>
                <p className="text-gray-500 text-sm">Pediatrician</p>
              </div>
            </div>
            <p className="text-gray-600">
              "The medication database with pediatric dosing calculations has been a game-changer for my practice. I feel more confident in my prescribing decisions."
            </p>
            <div className="mt-4 flex text-yellow-400">
              {[...Array(4)].map((_, i) => (
                <svg key={i} className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              ))}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" fillOpacity="0.3">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-gray-800">
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that's right for your practice
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 flex flex-col"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Solo Practice</h3>
            <div className="text-blue-600 text-4xl font-bold mb-4">$49<span className="text-gray-500 text-lg font-normal">/month</span></div>
            <p className="text-gray-600 mb-6">Perfect for individual practitioners with simple prescription needs.</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to 200 prescriptions/month
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Basic drug interaction checks
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                PDF Export
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Email Support
              </li>
            </ul>
            <a href="#" className="mt-auto px-6 py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg">Get Started</a>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-blue-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-blue-500 flex flex-col relative transform scale-105 z-10"
          >
            <div className="absolute -top-4 left-0 right-0 flex justify-center">
              <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Group Practice</h3>
            <div className="text-white text-4xl font-bold mb-4">$99<span className="text-blue-200 text-lg font-normal">/month</span></div>
            <p className="text-blue-100 mb-6">Ideal for small to medium practices with multiple providers.</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-white">
                <svg className="w-5 h-5 mr-2 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited prescriptions
              </li>
              <li className="flex items-center text-white">
                <svg className="w-5 h-5 mr-2 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Advanced drug interaction checking
              </li>
              <li className="flex items-center text-white">
                <svg className="w-5 h-5 mr-2 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Customizable PDF templates
              </li>
              <li className="flex items-center text-white">
                <svg className="w-5 h-5 mr-2 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Priority support
              </li>
              <li className="flex items-center text-white">
                <svg className="w-5 h-5 mr-2 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to 5 providers
              </li>
            </ul>
            <a href="#" className="mt-auto px-6 py-3 bg-white text-blue-600 text-center rounded-lg font-medium hover:bg-blue-50 transition-colors shadow-lg">Get Started</a>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-white/60 backdrop-blur-lg rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-white/20 flex flex-col"
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Enterprise</h3>
            <div className="text-blue-600 text-4xl font-bold mb-4">$199<span className="text-gray-500 text-lg font-normal">/month</span></div>
            <p className="text-gray-600 mb-6">For large practices and hospitals with advanced needs.</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited everything
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Clinical decision support
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                EMR integrations
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                API access
              </li>
              <li className="flex items-center text-gray-600">
                <svg className="w-5 h-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Dedicated account manager
              </li>
            </ul>
            <a href="#" className="mt-auto px-6 py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg">Contact Sales</a>
          </motion.div>
        </motion.div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="max-w-7xl mx-auto bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-8 md:p-12 shadow-xl relative overflow-hidden"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400 rounded-full filter blur-3xl opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400 rounded-full filter blur-3xl opacity-20 transform -translate-x-1/3 translate-y-1/3"></div>
          
          <div className="relative z-10 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Modernize Your Prescription Process?</h2>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Join thousands of healthcare professionals who have transformed their practice with SafeMeds's intelligent prescription system.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
              <a href="#" className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors shadow-lg">
                Start Free Trial
              </a>
              <a href="#" className="px-8 py-3 border border-white text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Request Demo
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
  <div className="max-w-7xl mx-auto">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div>
        <div className="text-2xl font-bold text-white flex items-center mb-4">
        <img 
                src="/logo.png" 
                alt="DNA illustration" 
                className="w-10 h-10"
              />
          SafeMeds
        </div>
        <p className="text-gray-400 mb-4">
          Intelligent prescription management for modern healthcare professionals.
        </p>
        
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Product</h3>
        <ul className="space-y-2">
          <li>
            <a href="#features" className="text-gray-400 hover:text-white transition-colors">
              Features
            </a>
          </li>
          <li>
            <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">
              How It Works
            </a>
          </li>
          <li>
            <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">
              Pricing
            </a>
          </li>
          <li>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              Integrations
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Company</h3>
        <ul className="space-y-2">
          <li>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              About Us
            </a>
          </li>
          <li>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              Careers
            </a>
          </li>
          <li>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              Blog
            </a>
          </li>
          <li>
            <a href="#" className="text-gray-400 hover:text-white transition-colors">
              Contact
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Stay Updated</h3>
        <p className="text-gray-400 mb-4">
          Subscribe to our newsletter for the latest updates and insights.
        </p>
        <form className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="Enter your email"
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Subscribe
          </button>
        </form>
      </div>
    </div>

    <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
      <p className="text-gray-400 text-sm">
        © {new Date().getFullYear()} SafeMeds. All rights reserved.
      </p>
      <div className="mt-4 md:mt-0 flex space-x-4">
        <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
          Privacy Policy
        </a>
        <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
          Terms of Service
        </a>
        <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
          Cookie Policy
        </a>
      </div>
    </div>
  </div>
</footer>
    </div>
  );
}