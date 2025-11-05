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
  const [notifications, setNotifications] = useState([]);
  const [isLeaving, setIsLeaving] = useState(false);

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
      const audioTracks = remoteStream.getAudioTracks();
      const videoTracks = remoteStream.getVideoTracks();

      console.log('Received remote stream from', socketId, {
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        trackDetails: remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
      });

      // Ensure audio and video tracks are enabled
      remoteStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`Track ${track.kind} enabled:`, track.enabled, 'readyState:', track.readyState);
      });

      setRemoteStreams(prev => {
        const existing = prev.find(s => s.socketId === socketId);
        if (existing) {
          // Update existing stream
          return prev.map(s =>
            s.socketId === socketId
              ? { ...s, stream: remoteStream }
              : s
          );
        } else {
          // Add new stream
          return [...prev, { socketId, stream: remoteStream }];
        }
      });

      // Update video element immediately
      setTimeout(() => {
        const videoElement = userVideoRefs.current[socketId];
        if (videoElement && remoteStream) {
          videoElement.srcObject = remoteStream;
          videoElement.muted = false;
          videoElement.volume = 1.0;

          // Ensure audio plays
          videoElement.play().catch(err => {
            console.error('Error playing remote video:', err);
          });

          console.log('Video element updated for', socketId, {
            muted: videoElement.muted,
            volume: videoElement.volume,
            paused: videoElement.paused
          });
        }
      }, 100);
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

    // Get stream from ref (more reliable than state)
    const localStream = myVideoRef.current?.srcObject;

    // Add local stream to peer (both video and audio tracks)
    if (localStream && localStream.getTracks) {
      localStream.getTracks().forEach(track => {
        // Ensure tracks are enabled
        track.enabled = true;
        peer.addTrack(track, localStream);
      });
    }

    // Create and send offer with audio and video
    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
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
    if (existingUsers && existingUsers.length > 0) {
      // Wait for stream to be ready
      const connectWhenReady = async (retries = 10) => {
        // Check if stream is ready by checking the ref
        const stream = myVideoRef.current?.srcObject;
        if (stream && stream.getTracks && stream.getTracks().length > 0) {
          // Stream is ready, connect to peers
          for (const user of existingUsers) {
            await connectToPeer(user.socketId, user.email);
          }
        } else if (retries > 0) {
          // Retry after a short delay
          setTimeout(() => connectWhenReady(retries - 1), 500);
        }
      };
      connectWhenReady();
    }
  };

  const handleUserJoined = async ({ email, socketId }) => {
    console.log('User joined:', email);

    // Connect to the new peer - wait a bit for stream to be ready
    const connectWithRetry = async (retries = 10) => {
      // Check if stream is ready by checking the ref
      const stream = myVideoRef.current?.srcObject;
      if (stream && stream.getTracks && stream.getTracks().length > 0) {
        await connectToPeer(socketId, email);
      } else if (retries > 0) {
        setTimeout(() => connectWithRetry(retries - 1), 500);
      }
    };

    connectWithRetry();
  };

  const handleUserLeft = ({ socketId, email }) => {
    console.log('User left:', socketId, email);

    // Find the participant who left
    const leavingParticipant = participants.find(p => p.socketId === socketId);
    const leavingEmail = email || leavingParticipant?.email || 'A participant';

    // Show notification
    const notificationId = Date.now();
    setNotifications(prev => [...prev, {
      id: notificationId,
      message: `${leavingEmail} left the room`,
      type: 'info'
    }]);

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 5000);

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

      // Add local stream (both video and audio tracks)
      const localStream = myVideoRef.current?.srcObject;
      if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach(track => {
          // Ensure tracks are enabled
          track.enabled = true;
          peer.addTrack(track, localStream);
        });
      }

      // Create and send answer with audio and video
      const answer = await peer.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
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
      if (signal.candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
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

    // Request media stream with audio constraints
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })
        .then((stream) => {
          console.log('Got local stream with tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

          // Ensure all tracks are enabled
          stream.getTracks().forEach(track => {
            track.enabled = true;
            console.log(`Local ${track.kind} track enabled:`, track.enabled);
          });

          setMyStream(stream);
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
            // Local video should be muted to prevent echo
            myVideoRef.current.muted = true;
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

  // Effect to ensure remote video elements have audio enabled
  useEffect(() => {
    remoteStreams.forEach(({ socketId, stream }) => {
      const videoElement = userVideoRefs.current[socketId];
      if (videoElement && stream) {
        // Ensure audio is enabled
        videoElement.muted = false;
        videoElement.volume = 1.0;

        // Check audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => {
            track.enabled = true;
            console.log(`Ensuring audio track enabled for ${socketId}:`, track.enabled);
          });
        }

        // Force play
        videoElement.play().catch(err => {
          console.error('Error playing audio for', socketId, err);
        });
      }
    });
  }, [remoteStreams]);

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
    const stream = myVideoRef.current?.srcObject || myStream;
    if (stream && stream.getAudioTracks) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !isAudioEnabled;
        audioTracks.forEach(track => {
          track.enabled = newState;
          console.log(`Audio track ${track.id} enabled:`, newState);
        });
        setIsAudioEnabled(newState);

        // Update all peer connections to reflect the change
        Object.values(peersRef.current).forEach(peer => {
          // The track state change will automatically propagate
        });
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sessionLink);
    alert('Link copied to clipboard!');
  };

  const leaveRoom = async () => {
    // Prevent double-clicks
    if (isLeaving) {
      return;
    }

    setIsLeaving(true);

    try {
      console.log('Leaving room, roomId:', roomId);

      // Emit leave-room event to notify others
      socket.emit('leave-room', { roomId });

      // Stop all tracks
      const stream = myVideoRef.current?.srcObject;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
      }
      if (myStream) {
        myStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped myStream track:', track.kind);
        });
      }

      // Close all peer connections
      Object.values(peersRef.current).forEach(peer => {
        try {
          peer.destroy();
        } catch (e) {
          console.error('Error destroying peer:', e);
        }
      });

      // Clean up socket listeners
      socket.off('joined-room');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('receive-signal');
      socket.off('peer-connected');

      // Clear refs
      peersRef.current = {};
      userVideoRefs.current = {};

      // Get userType before any delay
      const userType = localStorage.getItem('userType') || 'student';
      console.log('Leaving room, userType:', userType, 'navigating to:', userType === 'teacher' ? '/teacher' : '/student');

      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Navigate back - use window.location as fallback if navigate doesn't work
      const targetPath = userType === 'teacher' ? '/teacher' : '/student';

      try {
        navigate(targetPath, { replace: true });
        // Force navigation after a short delay if navigate doesn't work
        setTimeout(() => {
          if (window.location.pathname.includes('/room/')) {
            console.log('Navigation failed, forcing redirect...');
            window.location.href = targetPath;
          }
        }, 200);
      } catch (navError) {
        console.error('Navigation error, using window.location:', navError);
        window.location.href = targetPath;
      }
    } catch (error) {
      console.error('Error leaving room:', error);
      // Force navigation even if there's an error
      const userType = localStorage.getItem('userType') || 'student';
      const targetPath = userType === 'teacher' ? '/teacher' : '/student';
      window.location.href = targetPath;
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
          disabled={isLeaving}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLeaving ? 'Leaving...' : 'Leave Room'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 text-white p-4 border-b border-red-700">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out"
              style={{ animation: 'slideInRight 0.3s ease-out' }}
            >
              <p className="text-sm">{notification.message}</p>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

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
                    if (el) {
                      userVideoRefs.current[socketId] = el;

                      if (stream) {
                        el.srcObject = stream;
                        // Ensure audio is enabled and playing
                        el.muted = false;
                        el.volume = 1.0;

                        // Force play to ensure audio works
                        el.play().then(() => {
                          console.log('Remote video playing for', socketId);
                          // Double-check audio settings
                          el.muted = false;
                          el.volume = 1.0;
                        }).catch(err => {
                          console.error('Error playing remote video:', err);
                        });

                        // Listen for track events
                        stream.getTracks().forEach(track => {
                          track.onended = () => {
                            console.log('Track ended:', track.kind, socketId);
                          };
                          track.onmute = () => {
                            console.log('Track muted:', track.kind, socketId);
                            track.enabled = true;
                          };
                        });
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  muted={false}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    // Ensure audio when metadata loads
                    e.target.muted = false;
                    e.target.volume = 1.0;
                    e.target.play().catch(err => console.error('Play error:', err));
                  }}
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
