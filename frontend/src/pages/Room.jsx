import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../Provider/Socket';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PlayIcon, PauseIcon, FullscreenIcon, VolumeIcon, VolumeOffIcon } from '../components/Icons';

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
  const [videoControls, setVideoControls] = useState({}); // {socketId: {volume: 1, muted: false, playing: true}}
  const [showControls, setShowControls] = useState({}); // {socketId: boolean}

  const myVideoRef = useRef(null);
  const [needsPreviewTap, setNeedsPreviewTap] = useState(false);
  const peersRef = useRef({});
  const userVideoRefs = useRef({});

  // Retry getUserMedia on user gesture (production/mobile may require it)
  const retryLocalMedia = async () => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setError('Your browser does not support video streaming.');
      return;
    }
    const attempts = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
      { video: true, audio: true },
      { video: { facingMode: 'user' }, audio: true }
    ];
    for (let i = 0; i < attempts.length; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
        stream.getTracks().forEach(t => (t.enabled = true));
        setMyStream(stream);
        if (myVideoRef.current) {
          const el = myVideoRef.current;
          el.srcObject = stream;
          el.muted = true;
          el.playsInline = true;
          await el.play().catch(() => { });
          setNeedsPreviewTap(false);
        }
        return;
      } catch (e) {
        if (i === attempts.length - 1) {
          setError('Could not access camera/microphone. Please allow permissions.');
        }
      }
    }
  };

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

    // Request media stream with robust fallbacks (dev auto-start, prod require gesture)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const tryGetUserMedia = async () => {
        // Secure context check (required by browsers for camera/mic)
        if (window.isSecureContext === false && window.location.protocol !== 'https:') {
          setError('Camera requires HTTPS. Please use a secure URL.');
        }

        const attempts = [
          // Preferred HD with audio processing
          {
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          },
          // Generic fallback
          { video: true, audio: true },
          // Mobile-friendly front camera fallback
          { video: { facingMode: 'user' }, audio: true }
        ];

        const requestWithConstraints = async (constraints) => {
          console.log('Requesting media with constraints:', constraints);
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          // If no video track, try to pick a concrete device
          const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;
          if (!hasVideo) {
            try {
              const devices = await navigator.mediaDevices.enumerateDevices();
              const cameras = devices.filter(d => d.kind === 'videoinput');
              if (cameras.length > 0) {
                stream.getTracks().forEach(t => t.stop());
                const deviceId = cameras[0].deviceId;
                console.log('Retrying with concrete camera deviceId:', deviceId);
                const retryStream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: deviceId } },
                  audio: true
                });
                return retryStream;
              }
            } catch (e) {
              console.warn('enumerateDevices/retry failed:', e);
            }
          }
          return stream;
        };

        for (let i = 0; i < attempts.length; i++) {
          try {
            const stream = await requestWithConstraints(attempts[i]);
            console.log('Got local stream with tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

            // Ensure all tracks are enabled
            stream.getTracks().forEach(track => {
              track.enabled = true;
              console.log(`Local ${track.kind} track enabled:`, track.enabled);
            });

            setMyStream(stream);
            if (myVideoRef.current) {
              const el = myVideoRef.current;
              el.srcObject = stream;
              // Local video should be muted to prevent echo
              el.muted = true;
              el.playsInline = true;
              // Attempt autoplay; show a user-gesture button if it fails
              el.play().then(() => {
                setNeedsPreviewTap(false);
              }).catch(() => {
                setNeedsPreviewTap(true);
                setTimeout(() => el.play().catch(() => { }), 300);
              });
              el.onloadedmetadata = () => {
                el.play().then(() => setNeedsPreviewTap(false)).catch(() => setNeedsPreviewTap(true));
              };
            }

            // Join room
            const email = localStorage.getItem('studentEmail') || localStorage.getItem('teacherEmail') || 'user@example.com';
            socket.emit('join-room', { email, roomId, userType });
            setLoading(false);
            return; // success
          } catch (err) {
            console.warn(`getUserMedia attempt ${i + 1} failed:`, err);
            if (i === attempts.length - 1) {
              // Exhausted attempts
              setError('Could not access camera/microphone. Please allow permissions and ensure your device has a camera.');
              setLoading(false);
              const email = localStorage.getItem('studentEmail') || localStorage.getItem('teacherEmail') || 'user@example.com';
              socket.emit('join-room', { email, roomId, userType });
            }
          }
        }
      };

      // Only auto-start camera on localhost for dev convenience; in prod wait for user gesture
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        tryGetUserMedia();
      } else {
        setNeedsPreviewTap(true);
      }
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
        // Check audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => {
            track.enabled = true;
          });
        }

        // Initialize controls if not exists
        setVideoControls(prev => {
          if (!prev[socketId]) {
            return {
              ...prev,
              [socketId]: {
                volume: videoElement.volume || 1.0,
                muted: videoElement.muted || false,
                playing: !videoElement.paused
              }
            };
          }
          return prev;
        });

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
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                el.play().catch(() => setNeedsPreviewTap(true));
              }}
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-sm">
              You {isTeacher ? '(Teacher)' : '(Student)'}
            </div>
            {!myStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <button
                  onClick={retryLocalMedia}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Enable Camera
                </button>
              </div>
            )}
            {needsPreviewTap && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <button
                  onClick={() => {
                    const el = myVideoRef.current;
                    if (el) {
                      el.play().then(() => setNeedsPreviewTap(false)).catch(() => setNeedsPreviewTap(true));
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Enable Preview
                </button>
              </div>
            )}
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <VideoOffIcon className="w-16 h-16 text-gray-500" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {remoteStreams.map(({ socketId, stream }) => {
            const participant = participants.find(p => p.socketId === socketId);
            const controls = videoControls[socketId] || { volume: 1.0, muted: false, playing: true };

            return (
              <div
                key={socketId}
                className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video group cursor-pointer"
                onMouseEnter={() => setShowControls(prev => ({ ...prev, [socketId]: true }))}
                onMouseLeave={() => setShowControls(prev => ({ ...prev, [socketId]: false }))}
                onClick={() => {
                  // Toggle controls on click
                  setShowControls(prev => ({ ...prev, [socketId]: !prev[socketId] }));
                }}
              >
                <video
                  ref={(el) => {
                    if (el) {
                      userVideoRefs.current[socketId] = el;

                      if (stream) {
                        el.srcObject = stream;
                        // Ensure audio is enabled and playing
                        el.muted = controls.muted;
                        el.volume = controls.volume;

                        // Force play to ensure audio works
                        el.play().then(() => {
                          console.log('Remote video playing for', socketId);
                          // Double-check audio settings
                          el.muted = controls.muted;
                          el.volume = controls.volume;
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
                  muted={controls.muted}
                  volume={controls.volume}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    // Ensure audio when metadata loads
                    e.target.muted = controls.muted;
                    e.target.volume = controls.volume;
                    e.target.play().catch(err => console.error('Play error:', err));
                  }}
                />

                {/* Video Controls Overlay */}
                {showControls[socketId] && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity">
                    <div className="bg-gray-900 bg-opacity-90 rounded-lg p-4 w-full mx-4" onClick={(e) => e.stopPropagation()}>
                      {/* Play/Pause Button */}
                      <div className="flex items-center justify-center space-x-4 mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const videoEl = userVideoRefs.current[socketId];
                            if (videoEl) {
                              if (videoEl.paused) {
                                videoEl.play();
                                setVideoControls(prev => ({
                                  ...prev,
                                  [socketId]: { ...(prev[socketId] || { volume: 1.0, muted: false, playing: true }), playing: true }
                                }));
                              } else {
                                videoEl.pause();
                                setVideoControls(prev => ({
                                  ...prev,
                                  [socketId]: { ...(prev[socketId] || { volume: 1.0, muted: false, playing: true }), playing: false }
                                }));
                              }
                            }
                          }}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors flex items-center justify-center"
                          title={controls.playing ? 'Pause' : 'Play'}
                        >
                          {controls.playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                        </button>

                        {/* Mute/Unmute */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const videoEl = userVideoRefs.current[socketId];
                            if (videoEl) {
                              const newMuted = !controls.muted;
                              videoEl.muted = newMuted;
                              setVideoControls(prev => ({
                                ...prev,
                                [socketId]: { ...(prev[socketId] || { volume: 1.0, muted: false, playing: true }), muted: newMuted }
                              }));
                            }
                          }}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors flex items-center justify-center"
                          title={controls.muted ? 'Unmute' : 'Mute'}
                        >
                          {controls.muted ? <VolumeOffIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
                        </button>

                        {/* Fullscreen */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const videoEl = userVideoRefs.current[socketId];
                            if (videoEl) {
                              if (videoEl.requestFullscreen) {
                                videoEl.requestFullscreen();
                              } else if (videoEl.webkitRequestFullscreen) {
                                videoEl.webkitRequestFullscreen();
                              } else if (videoEl.mozRequestFullScreen) {
                                videoEl.mozRequestFullScreen();
                              }
                            }
                          }}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors flex items-center justify-center"
                          title="Fullscreen"
                        >
                          <FullscreenIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Volume Control */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-300 w-12">Volume:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={controls.volume}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newVolume = parseFloat(e.target.value);
                            const videoEl = userVideoRefs.current[socketId];
                            if (videoEl) {
                              videoEl.volume = newVolume;
                              setVideoControls(prev => ({
                                ...prev,
                                [socketId]: { ...(prev[socketId] || { volume: 1.0, muted: false, playing: true }), volume: newVolume }
                              }));
                            }
                          }}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-gray-300 w-8">{Math.round(controls.volume * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}

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
            className={`px-6 py-3 rounded-lg transition-colors flex items-center space-x-2 ${isAudioEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
          >
            {isAudioEnabled ? <MicIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
            <span>{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          <button
            onClick={toggleVideo}
            className={`px-6 py-3 rounded-lg transition-colors flex items-center space-x-2 ${isVideoEnabled
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
          >
            {isVideoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
            <span>{isVideoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Room;
