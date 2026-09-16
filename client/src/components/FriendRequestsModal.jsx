import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Check, UserCheck, Clock, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FriendRequestsModal({ onClose, onConversationUnlocked, onInspectUser }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('received'); // 'received', 'search', 'sent'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.incoming || []);
        setOutgoingRequests(data.outgoing || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (targetUserId) => {
    try {
      const res = await fetch('/api/requests/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId: targetUserId })
      });
      if (res.ok) {
        // Update local search state
        setSearchResults(prev => prev.map(u => {
          if (u.id === targetUserId) {
            return { ...u, connectionStatus: 'pending_sent' };
          }
          return u;
        }));
        fetchRequests();
      } else {
        const err = await res.json();
        alert(err.message || 'Could not send request');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        fetchRequests();
        if (onConversationUnlocked) {
          onConversationUnlocked(data.conversationId);
        }
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/reject`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none">
      <div className="bg-dark-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-4 sm:mb-5 pr-8">
          <h3 className="text-lg sm:text-xl font-bold text-white">Friends & Chat Requests</h3>
          <p className="text-xs text-slate-400 mt-0.5">Connect with friends via unique username before starting chat</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mb-4 overflow-x-auto no-scrollbar space-x-1">
          <button
            onClick={() => setActiveTab('received')}
            className={`pb-3 px-3 sm:px-4 text-xs font-semibold whitespace-nowrap flex-shrink-0 relative transition ${
              activeTab === 'received' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Received</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`pb-3 px-3 sm:px-4 text-xs font-semibold whitespace-nowrap flex-shrink-0 relative transition ${
              activeTab === 'search' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Find @Username</span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-3 sm:px-4 text-xs font-semibold whitespace-nowrap flex-shrink-0 relative transition ${
              activeTab === 'sent' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Sent ({outgoingRequests.length})</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* TAB 1: RECEIVED REQUESTS */}
          {activeTab === 'received' && (
            <>
              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No pending friend requests.
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div key={req.id} className="p-3.5 bg-dark-950/80 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                    <div 
                      onClick={() => onInspectUser?.({
                        id: req.sender_id,
                        name: req.sender_name,
                        username: req.sender_username,
                        avatar: req.sender_avatar,
                        bio: req.sender_bio
                      })}
                      className="flex items-center space-x-3 cursor-pointer group/user flex-1 min-w-0 mr-2"
                      title="Click to view full profile"
                    >
                      <img
                        src={req.sender_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.sender_username}`}
                        alt={req.sender_name}
                        className="w-11 h-11 rounded-2xl bg-slate-800 object-cover border border-slate-700 group-hover/user:ring-2 group-hover/user:ring-brand-500/60 transition-all flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm group-hover/user:text-brand-400 transition-colors truncate">{req.sender_name}</div>
                        <div className="text-xs text-brand-400 font-mono truncate">@{req.sender_username}</div>
                        {req.sender_bio && <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{req.sender_bio}</div>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() => acceptRequest(req.id)}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow-md flex items-center space-x-1 text-xs font-medium"
                        title="Accept Request"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => rejectRequest(req.id)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition text-xs"
                        title="Decline"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* TAB 2: SEARCH USERS */}
          {activeTab === 'search' && (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder="Search by @username, name, or email..."
                  className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500 transition"
                  autoFocus
                />
              </div>

              {loading && <div className="text-center py-6 text-xs text-slate-500">Searching user database...</div>}

              {!loading && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="text-center py-8 text-xs text-slate-500">No users found matching "{searchQuery}"</div>
              )}

              {searchResults.map((u) => (
                <div key={u.id} className="p-3 bg-dark-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div 
                    onClick={() => onInspectUser?.(u)}
                    className="flex items-center space-x-3 cursor-pointer group/user flex-1 min-w-0 mr-2"
                    title="Click to view full profile"
                  >
                    <img
                      src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                      alt={u.name}
                      className="w-10 h-10 rounded-2xl bg-slate-800 object-cover border border-slate-700 group-hover/user:ring-2 group-hover/user:ring-brand-500/60 transition-all flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs sm:text-sm group-hover/user:text-brand-400 transition-colors truncate">{u.name}</div>
                      <div className="text-[11px] text-brand-400 font-mono truncate">@{u.username}</div>
                    </div>
                  </div>

                  {u.connectionStatus === 'friends' ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center space-x-1 border border-emerald-500/30 flex-shrink-0">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Friends</span>
                    </span>
                  ) : u.connectionStatus === 'pending_sent' ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-medium flex items-center space-x-1 border border-amber-500/30 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Requested</span>
                    </span>
                  ) : u.connectionStatus === 'pending_received' ? (
                    <button
                      onClick={() => acceptRequest(u.requestId)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex-shrink-0"
                    >
                      Accept Request
                    </button>
                  ) : (
                    <button
                      onClick={() => sendRequest(u.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition flex items-center space-x-1 shadow-md shadow-brand-600/20 flex-shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {/* TAB 3: SENT REQUESTS */}
          {activeTab === 'sent' && (
            <>
              {outgoingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No sent requests pending.</div>
              ) : (
                outgoingRequests.map((req) => (
                  <div key={req.id} className="p-3.5 bg-dark-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div 
                      onClick={() => onInspectUser?.({
                        id: req.receiver_id,
                        name: req.receiver_name,
                        username: req.receiver_username,
                        avatar: req.receiver_avatar
                      })}
                      className="flex items-center space-x-3 cursor-pointer group/user flex-1 min-w-0 mr-2"
                      title="Click to view full profile"
                    >
                      <img
                        src={req.receiver_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.receiver_username}`}
                        alt={req.receiver_name}
                        className="w-10 h-10 rounded-2xl bg-slate-800 object-cover border border-slate-700 group-hover/user:ring-2 group-hover/user:ring-brand-500/60 transition-all flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm group-hover/user:text-brand-400 transition-colors truncate">{req.receiver_name}</div>
                        <div className="text-xs text-brand-400 font-mono truncate">@{req.receiver_username}</div>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium flex items-center space-x-1 border border-slate-700 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pending Acceptance</span>
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
