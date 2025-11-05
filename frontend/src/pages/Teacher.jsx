import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../Provider/Socket';
import apiClient from '../utils/api';

const Teacher = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [roomId, setRoomId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleStartSession = async () => {
        try {
            setLoading(true);
            setError('');

            // Generate a unique room ID or use existing one
            const newRoomId = roomId || `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Generate the room URL
            const roomUrl = `${window.location.origin}/room/${newRoomId}`;

            // Save session to database
            const response = await apiClient.post('/api/live-sessions', {
                userurl: roomUrl
            });

            if (response.data.success) {
                // Store user type
                localStorage.setItem('userType', 'teacher');
                localStorage.setItem('teacherEmail', response.data.data?.email || 'teacher@tutorarc.com');

                // Emit event to create/join room as teacher
                socket.emit('create-room', { roomId: newRoomId, userType: 'teacher' });

                // Navigate to room
                navigate(`/room/${newRoomId}`);
            } else {
                setError('Failed to create session. Please try again.');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            setError(error.response?.data?.message || 'Failed to create session. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Navbar */}
            <nav className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                            TutorArc
                        </Link>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-600">Teacher Dashboard</span>
                            <button
                                onClick={() => navigate('/teacher-login')}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Welcome, Teacher!
                    </h1>
                    <p className="text-xl text-gray-600">
                        Start a new teaching session or continue with an existing one
                    </p>
                </div>

                {/* Session Card */}
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <div className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleStartSession}
                            disabled={loading}
                            className="w-full py-4 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {loading ? 'Creating Session...' : 'Start Session'}
                        </button>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> When you start a session, you'll receive a unique room link that you can share with your students.
                            </p>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
};

export default Teacher;

