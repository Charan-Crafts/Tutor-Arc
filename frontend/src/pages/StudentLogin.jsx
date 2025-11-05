import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const StudentLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // TODO: Implement student login logic
        console.log('Student login:', { email, password });
        // Store email for later use
        localStorage.setItem('studentEmail', email);
        // Navigate to student dashboard
        navigate('/student');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 bg-white shadow-md z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                            TutorArc
                        </Link>
                        <div className="flex space-x-4">
                            <Link
                                to="/teacher-login"
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            >
                                Teacher Login
                            </Link>
                            <Link
                                to="/student-login"
                                className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors border border-indigo-600 rounded-lg hover:bg-indigo-50"
                            >
                                Student Login
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Login Form */}
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-xl mt-16">
                <div>
                    <h2 className="text-center text-3xl font-bold text-gray-900">
                        Student Login
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Sign in to your student account
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Sign in
                        </button>
                    </div>

                    
                </form>
            </div>
        </div>
    );
};

export default StudentLogin;

