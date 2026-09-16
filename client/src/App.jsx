import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useSocket } from './context/SocketContext';
import SecurityShield from './components/SecurityShield';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import AuthModal from './components/AuthModal';
import FriendRequestsModal from './components/FriendRequestsModal';
import CallPermissionModal from './components/CallPermissionModal';
import OneOnOneCallModal from './components/OneOnOneCallModal';
import CreateMeetingModal from './components/CreateMeetingModal';
import MeetingRoomModal from './components/MeetingRoomModal';
import AdminDashboard from './components/AdminDashboard';
import SettingsModal from './components/SettingsModal';
import NotificationToast from './components/NotificationToast';
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt';
import UserProfileModal from './components/UserProfileModal';
import { MessageSquare, ShieldCheck, UserPlus, Video } from 'lucide-react';

export default function App() {
  const { user, token, loading } = useAuth();
  const { incomingCall, setIncomingCall, onlineUsers } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showCallPermissionModal, setShowCallPermissionModal] = useState(false);
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeMeetingRoom, setActiveMeetingRoom] = useState(null);
  const [activeOneOnOneCall, setActiveOneOnOneCall] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [inspectingUser, setInspectingUser] = useState(null);

  // Check URL parameters for direct meeting link join (e.g. /meet/room-xyz123)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/meet/')) {
      const roomId = path.replace('/meet/', '').trim();
      if (roomId) {
        setActiveMeetingRoom({ roomId, title: 'Joined Meeting', isHost: false });
      }
    }
  }, []);

  // Listen for device notification click event to open conversation
  useEffect(() => {
    const handleOpenChatEvent = (e) => {
      const convoId = e.detail?.conversationId;
      if (convoId) {
        handleSelectConversationById(convoId);
      }
    };
    window.addEventListener('wavy_open_chat', handleOpenChatEvent);
    return () => {
      window.removeEventListener('wavy_open_chat', handleOpenChatEvent);
    };
  }, [conversations]);

  // Fetch active conversations
  useEffect(() => {
    if (!token) return;
    fetchConversations();
    fetchPendingRequestsCount();

    const interval = setInterval(() => {
      fetchPendingRequestsCount();
    }, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chats/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
        // Maintain selection only if already actively chatting, but never auto-open on page refresh/load
        setActiveConversation(curr => {
          if (curr) {
            const found = data.find(c => c.id === curr.id);
            return found || null;
          }
          return null; // Stay on Home Page
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingRequestsCount = async () => {
    try {
      const res = await fetch('/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequestsCount(data.incoming?.length || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStreakUpdated = (convoId, newCount) => {
    setConversations(prev => prev.map(c => {
      if (c.id === convoId) {
        return { ...c, streakCount: newCount, isExpiringSoon: false, hoursRemaining: 24 };
      }
      return c;
    }));
    setActiveConversation(curr => {
      if (curr && curr.id === convoId) {
        return { ...curr, streakCount: newCount, isExpiringSoon: false, hoursRemaining: 24 };
      }
      return curr;
    });
  };

  const handleStartOneOnOneCall = (type, customPartner = null) => {
    const targetPartner = customPartner || activeConversation?.partner;
    if (!targetPartner) return;
    setActiveOneOnOneCall({
      partner: targetPartner,
      callType: type,
      isIncoming: false
    });
  };

  const handleStartMeeting = (roomId, title, isHost) => {
    setActiveMeetingRoom({ roomId, title, isHost });
  };

  const handleShareMeetingInChat = async (roomId, title) => {
    if (!activeConversation?.id) {
      alert('Please open a conversation to share this meeting invite.');
      return;
    }
    try {
      await fetch(`/api/chats/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messageType: 'meeting_invite',
          content: `Join my video meeting: ${title} (${window.location.origin}/meet/${roomId})`
        })
      });
      fetchConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectConversationById = async (convoId) => {
    if (!convoId) return;
    const numId = Number(convoId);
    let found = conversations.find(c => Number(c.id) === numId);
    if (!found) {
      try {
        const res = await fetch('/api/chats/conversations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data || []);
          found = data.find(c => Number(c.id) === numId);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (found) {
      setActiveConversation(found);
    }
  };

  if (loading && !user) {
    return (
      <div className="fixed inset-0 bg-dark-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <SecurityShield>
      <div className="h-screen w-screen flex flex-col bg-dark-950 overflow-hidden font-sans">
        {/* First-Time Device & Phone Notification Permission Prompt */}
        <NotificationPermissionPrompt />

        {/* Real-time Toast Notifications (Click to open chat) */}
        <NotificationToast
          onSelectConversationById={handleSelectConversationById}
          onOpenRequests={() => setShowRequestsModal(true)}
        />

        {/* Top Navbar */}
        <Navbar
          onGoHome={() => setActiveConversation(null)}
          onOpenRequests={() => setShowRequestsModal(true)}
          onOpenAdmin={() => setShowAdminDashboard(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onSelectConversationById={handleSelectConversationById}
          pendingRequestsCount={pendingRequestsCount}
        />

        {/* Main Split Body: Mobile-Responsive Sidebar + Chat Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar (Hidden on mobile phones if chat is opened) */}
          <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-shrink-0 h-full`}>
            <Sidebar
              conversations={conversations}
              activeConversation={activeConversation}
              onSelectConversation={setActiveConversation}
              onOpenRequests={() => setShowRequestsModal(true)}
              onInspectUser={setInspectingUser}
            />
          </div>

          {/* Right Main Chat Window (Full width on mobile phones when opened) */}
          <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-1 h-full overflow-hidden`}>
            {activeConversation ? (
              <ChatWindow
                conversation={activeConversation}
                onBack={() => setActiveConversation(null)}
                onOpenCallPermission={() => setShowCallPermissionModal(true)}
                onStartOneOnOneCall={handleStartOneOnOneCall}
                onOpenCreateMeeting={() => setShowCreateMeetingModal(true)}
                onStreakUpdated={handleStreakUpdated}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-dark-950 text-slate-500 p-8 text-center select-none">
                <div className="w-16 h-16 rounded-3xl bg-dark-900 border border-slate-800 flex items-center justify-center mb-4 text-brand-400 shadow-xl">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Welcome to Wavy</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                  Your private, screenshot-shielded messenger with mutual calling permissions, Snapchat streaks, and Zoom-like group meetings.
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowRequestsModal(true)}
                    className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-xs font-semibold transition flex items-center space-x-2 shadow-lg shadow-brand-600/30"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Connect with Friends</span>
                  </button>
                  <button
                    onClick={() => setShowCreateMeetingModal(true)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-semibold transition flex items-center space-x-2 border border-slate-700"
                  >
                    <Video className="w-4 h-4 text-indigo-400" />
                    <span>Create Meeting</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}

        {/* 1. Friend Requests Modal */}
        {showRequestsModal && (
          <FriendRequestsModal
            onClose={() => {
              setShowRequestsModal(false);
              fetchConversations();
              fetchPendingRequestsCount();
            }}
            onConversationUnlocked={(convoId) => {
              fetchConversations();
            }}
            onInspectUser={setInspectingUser}
          />
        )}

        {/* 2. Mutual Call Permission Modal */}
        {showCallPermissionModal && activeConversation?.partner && (
          <CallPermissionModal
            partner={activeConversation.partner}
            onClose={() => setShowCallPermissionModal(false)}
            onPermissionChanged={({ mutualAudioAllowed, mutualVideoAllowed }) => {
              setActiveConversation(curr => ({
                ...curr,
                mutualAudioAllowed,
                mutualVideoAllowed
              }));
              setConversations(prev => prev.map(c => {
                if (c.id === activeConversation.id) {
                  return { ...c, mutualAudioAllowed, mutualVideoAllowed };
                }
                return c;
              }));
            }}
          />
        )}

        {/* 3. 1-on-1 WebRTC Video/Audio Call Modal */}
        {(activeOneOnOneCall || incomingCall) && (
          <OneOnOneCallModal
            partner={incomingCall ? incomingCall.from : activeOneOnOneCall.partner}
            callType={incomingCall ? incomingCall.callType : activeOneOnOneCall.callType}
            isIncoming={Boolean(incomingCall)}
            incomingSignal={incomingCall?.signal}
            onClose={() => {
              setActiveOneOnOneCall(null);
              setIncomingCall(null);
            }}
          />
        )}

        {/* 4. Zoom-Style Create Meeting Modal */}
        {showCreateMeetingModal && (
          <CreateMeetingModal
            onClose={() => setShowCreateMeetingModal(false)}
            onStartMeeting={handleStartMeeting}
            onShareInChat={handleShareMeetingInChat}
          />
        )}

        {/* 5. Zoom-Style Group Video Meeting Room */}
        {activeMeetingRoom && (
          <MeetingRoomModal
            roomId={activeMeetingRoom.roomId}
            initialTitle={activeMeetingRoom.title}
            isHost={activeMeetingRoom.isHost}
            onClose={() => setActiveMeetingRoom(null)}
          />
        )}

        {/* 6. Super Admin Portal */}
        {showAdminDashboard && (
          <AdminDashboard
            onClose={() => setShowAdminDashboard(false)}
          />
        )}

        {/* 7. Settings Modal */}
        {showSettingsModal && (
          <SettingsModal
            onClose={() => {
              setShowSettingsModal(false);
              fetchConversations();
            }}
            onOpenCreateMeeting={() => {
              setShowSettingsModal(false);
              setShowCreateMeetingModal(true);
            }}
            onOpenCallPermission={activeConversation ? () => {
              setShowSettingsModal(false);
              setShowCallPermissionModal(true);
            } : () => {
              if (conversations.length > 0) {
                setActiveConversation(conversations[0]);
                setShowSettingsModal(false);
                setShowCallPermissionModal(true);
              } else {
                alert('Please connect with a friend first to configure call permissions.');
              }
            }}
            activeConversation={activeConversation}
          />
        )}

        {/* 8. User Profile Details Modal (Inspect another user's photo/bio/username/details) */}
        {inspectingUser && (
          <UserProfileModal
            targetUser={inspectingUser}
            onClose={() => setInspectingUser(null)}
            onStartAudioCall={(type) => handleStartOneOnOneCall(type, inspectingUser)}
            onStartVideoCall={(type) => handleStartOneOnOneCall(type, inspectingUser)}
            onStartChat={(partnerId) => {
              const targetConvo = conversations.find(c => c.partner?.id === partnerId);
              if (targetConvo) {
                setActiveConversation(targetConvo);
                setInspectingUser(null);
                setShowRequestsModal(false);
              }
            }}
          />
        )}
      </div>
    </SecurityShield>
  );
}
