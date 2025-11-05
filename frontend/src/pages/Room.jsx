import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../Provider/Socket';

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [myStream, setMyStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [sessionLink, setSessionLink] = useState('');
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const myVideoRef = useRef(null);
  const peersRef = useRef({});
  const userVideoRefs = useRef({});

  const createPeerConnection = (socketId) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Handle remote stream
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => {
        if (!prev.find(s => s.socketId === socketId)) {
          return [...prev, { socketId, stream: remoteStream }];
        }
        return prev;
      });
    };

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('send-signal', {
          signal: { type: 'ice-candidate', candidate: event.candidate },
          to: socketId,
          from: socket.id,
          roomId
        });
      }
    };

    return peer;
  };

  const connectToPeer = async (socketId, email) => {
    // Add to participants list
    setParticipants(prev => {
      if (!prev.find(p => p.socketId === socketId)) {
        return [...prev, { email, socketId }];
      }
      return prev;
    });

    // Create peer connection
    const peer = createPeerConnection(socketId);
    peersRef.current[socketId] = peer;

    // Add local stream to peer
    if (myStream) {
      myStream.getTracks().forEach(track => {
        peer.addTrack(track, myStream);
      });
    }

    // Create and send offer
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit('send-signal', {
      signal: offer,
      to: socketId,
      from: socket.id,
      roomId
    });
  };

  const handleJoinedRoom = async ({ existingUsers }) => {
    // Connect to existing users in the room
    if (existingUsers && existingUsers.length > 0 && myStream) {
      for (const user of existingUsers) {
        await connectToPeer(user.socketId, user.email);
      }
    }
  };

  const handleUserJoined = async ({ email, socketId }) => {
    console.log('User joined:', email);

    // Connect to the new peer
    if (myStream) {
      await connectToPeer(socketId, email);
    }
  };

  const handleUserLeft = ({ socketId }) => {
    console.log('User left:', socketId);

    // Remove from participants
    setParticipants(prev => prev.filter(p => p.socketId !== socketId));

    // Remove remote stream
    setRemoteStreams(prev => prev.filter(s => s.socketId !== socketId));

    // Close peer connection
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].destroy();
      delete peersRef.current[socketId];
    }

    // Remove video element
    if (userVideoRefs.current[socketId]) {
      delete userVideoRefs.current[socketId];
    }
  };

  const handleReceiveSignal = async ({ signal, from }) => {
    const peer = peersRef.current[from] || createPeerConnection(from);
    peersRef.current[from] = peer;

    if (signal.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));

      // Add local stream
      if (myStream) {
        myStream.getTracks().forEach(track => {
          peer.addTrack(track, myStream);
        });
      }

      // Create and send answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('send-signal', {
        signal: answer,
        to: from,
        from: socket.id,
        roomId
      });
    } else if (signal.type === 'answer') {
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.type === 'ice-candidate') {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  const handlePeerConnected = ({ socketId }) => {
    console.log('Peer connected:', socketId);
  };

  useEffect(() => {
    // Set session link
    const link = `${window.location.origin}/room/${roomId}`;
    setSessionLink(link);

    // Check if user is teacher (from localStorage or session)
    const userType = localStorage.getItem('userType') || 'student';
    setIsTeacher(userType === 'teacher');

    // Request media stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setMyStream(stream);
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
          }

          // Join room
          const email = localStorage.getItem('studentEmail') || localStorage.getItem('teacherEmail') || 'user@example.com';
          socket.emit('join-room', { email, roomId, userType });
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error accessing media devices:', err);
          setError('Could not access camera/microphone. Please allow permissions.');
          setLoading(false);

          // Still join room even without media
          const email = localStorage.getItem('studentEmail') || localStorage.getItem('teacherEmail') || 'user@example.com';
          socket.emit('join-room', { email, roomId, userType });
        });
    } else {
      setError('Your browser does not support video streaming.');
      setLoading(false);

      // Still join room
      const email = localStorage.getItem('studentEmail') || localStorage.getItem('teacherEmail') || 'user@example.com';
      socket.emit('join-room', { email, roomId, userType });
    }

    // Socket event handlers
    socket.on('joined-room', handleJoinedRoom);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('receive-signal', handleReceiveSignal);
    socket.on('peer-connected', handlePeerConnected);

    // Cleanup
    return () => {
      socket.off('joined-room');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('receive-signal');
      socket.off('peer-connected');

      // Clean up all peer connections
      Object.values(peersRef.current).forEach(peer => {
        peer.destroy();
      });

      // Stop all tracks
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId, socket]);

  const toggleVideo = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sessionLink);
    alert('Link copied to clipboard!');
  };

  const leaveRoom = () => {
    // Stop all tracks
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      peer.destroy();
    });

    // Navigate back
    if (isTeacher) {
      navigate('/teacher');
    } else {
      navigate('/student');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">TutorArc - Room: {roomId}</h1>
          {isTeacher && (
            <span className="px-3 py-1 bg-indigo-600 rounded-full text-sm">Teacher</span>
          )}
        </div>
        <button
          onClick={leaveRoom}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
        >
          Leave Room
        </button>
      </div>

      {error && (
        <div className="bg-red-900 text-white p-4 border-b border-red-700">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Session Link Display (for Teacher) */}
      {isTeacher && (
        <div className="bg-indigo-900 p-4 border-b border-indigo-700">
          <div className="max-w-6xl mx-auto">
            <p className="text-sm mb-2">Share this link with your students:</p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={sessionLink}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-white"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* My Video */}
          <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
            <video
              ref={myVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
              You {isTeacher ? '(Teacher)' : '(Student)'}
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-6xl">📹</div>
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {remoteStreams.map(({ socketId, stream }) => {
            const participant = participants.find(p => p.socketId === socketId);
            return (
              <div key={socketId} className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={(el) => {
                    if (el && stream) {
                      el.srcObject = stream;
                    }
                    userVideoRefs.current[socketId] = el;
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
                  {participant?.email || 'Participant'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`px-6 py-3 rounded-lg transition-colors ${isAudioEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
          >
            {isAudioEnabled ? '🔊' : '🔇'} {isAudioEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button
            onClick={toggleVideo}
            className={`px-6 py-3 rounded-lg transition-colors ${isVideoEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
          >
            {isVideoEnabled ? '📹' : '📵'} {isVideoEnabled ? 'Stop Video' : 'Start Video'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Room;
