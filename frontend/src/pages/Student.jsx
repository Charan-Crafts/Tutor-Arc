import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../Provider/Socket';

const Student = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [classLink, setClassLink] = useState('');

    const handleJoinClass = () => {
        if (!classLink.trim()) {
            alert('Please paste a class link');
            return;
        }

        // Extract room ID from the link or use the link as is
        // Assuming the link format might be like: /room/roomId or just roomId
        let roomId = classLink.trim();

        // If it's a full URL, extract the room ID
        if (classLink.includes('/room/')) {
            roomId = classLink.split('/room/')[1]?.split('?')[0] || roomId;
        }

        // Emit event to join room as student
        socket.emit('join-room', {
            email: localStorage.getItem('studentEmail') || 'student@example.com',
            roomId: roomId,
            userType: 'student'
        });

        // Navigate to room
        navigate(`/room/${roomId}`);
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
                            <span className="text-gray-600">Student Dashboard</span>
                            <button
                                onClick={() => navigate('/student-login')}
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
                        Welcome, Student!
                    </h1>
                    <p className="text-xl text-gray-600">
                        Join your class by pasting the class link provided by your teacher
                    </p>
                </div>

                {/* Join Class Card */}
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="classLink" className="block text-sm font-medium text-gray-700 mb-2">
                                Paste Class Link
                            </label>
                            <input
                                id="classLink"
                                type="text"
                                value={classLink}
                                onChange={(e) => setClassLink(e.target.value)}
                                placeholder="Paste the class link here..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                            />
                        </div>

                        <button
                            onClick={handleJoinClass}
                            className="w-full py-4 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-lg"
                        >
                            Join Class
                        </button>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>How to join:</strong> Your teacher will provide you with a class link. Simply paste it above and click "Join Class" to enter the session.
                            </p>
                        </div>
                    </div>
                </div>

                
            </div>
        </div>
    );
};

export default Student;

