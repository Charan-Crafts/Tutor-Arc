import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navbar */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0">
              <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                TutorArc
              </Link>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/teacher-login"
                className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors border border-indigo-600 rounded-lg hover:bg-indigo-50"
              >
                Teacher Login
              </Link>
              <Link
                to="/student-login"
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
              >
                Student Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-indigo-600">TutorArc</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Your premier platform for online learning and interactive teaching.
            Connect, teach, and learn seamlessly with our advanced WebRTC technology.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/teacher-login"
              className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:w-auto"
            >
              I'm a Teacher
            </Link>
            <Link
              to="/student-login"
              className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg border-2 border-indigo-600 hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:w-auto"
            >
              I'm a Student
            </Link>
          </div>
        </div>

        
      </div>
    </div>
  );
};

export default Home;
