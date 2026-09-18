import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Users, MessageSquare, Video, Ban, Trash2,
  Eye, RefreshCw, X, Search, CheckCircle, ArrowRight,
  Key, UserPlus, LogIn, Check, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function AdminDashboard({ onClose }) {
  const { token } = useAuth();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'users', 'stats'
  const [stats, setStats] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [convoMessages, setConvoMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Password reset modal state
  const [resetModal, setResetModal] = useState({
    open: false,
    user: null,
    newPassword: '',
    loading: false,
    error: '',
    success: ''
  });

  // Create user modal state
  const [createModal, setCreateModal] = useState({
    open: false,
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user',
    loading: false,
    error: '',
    success: ''
  });

  useEffect(() => {
    fetchStats();
    fetchConversations();
    fetchUsers();

    // Listen for live messages across the entire platform
    if (socket) {
      socket.on('admin_live_message', ({ conversationId, message }) => {
        // If viewing this conversation, append in real-time
        setSelectedConvo(curr => {
          if (curr && curr.id === conversationId) {
            setConvoMessages(prev => [...prev, message]);
          }
          return curr;
        });

        // Update last message in conversations list
        setConversations(prev => prev.map(c => {
          if (c.id === conversationId) {
            return {
              ...c,
              totalMessages: c.totalMessages + 1,
              lastMessage: message,
              lastMessageTime: new Date().toISOString()
            };
          }
          return c;
        }));
      });
    }

    return () => {
      if (socket) socket.off('admin_live_message');
    };
  }, [socket]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleInspectConversation = async (convo) => {
    setSelectedConvo(convo);
    try {
      const res = await fetch(`/api/admin/conversations/${convo.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const msgs = await res.json();
        setConvoMessages(msgs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleBan = async (userId, currentBanStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentBanStatus ? 'unban' : 'ban'} this user?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isBanned: !currentBanStatus })
      });
      if (res.ok) {
        fetchUsers();
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this user account?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
        fetchStats();
        fetchConversations();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetModal.user || !resetModal.newPassword) return;
    if (resetModal.newPassword.length < 6) {
      setResetModal(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }
    setResetModal(prev => ({ ...prev, loading: true, error: '', success: '' }));
    try {
      const res = await fetch(`/api/admin/users/${resetModal.user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: resetModal.newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password');
      setResetModal(prev => ({ ...prev, success: `Password updated to '${resetModal.newPassword}' successfully!` }));
      setTimeout(() => {
        setResetModal({ open: false, user: null, newPassword: '', loading: false, error: '', success: '' });
      }, 1500);
    } catch (err) {
      setResetModal(prev => ({ ...prev, error: err.message }));
    } finally {
      setResetModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, password, role } = createModal;
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setCreateModal(prev => ({ ...prev, error: 'All fields are required' }));
      return;
    }
    if (password.length < 6) {
      setCreateModal(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
      return;
    }
    setCreateModal(prev => ({ ...prev, loading: true, error: '', success: '' }));
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, username, email, password, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');
      setCreateModal(prev => ({ ...prev, success: `User @${data.user.username} created successfully!` }));
      fetchUsers();
      fetchStats();
      setTimeout(() => {
        setCreateModal({ open: false, name: '', username: '', email: '', password: '', role: 'user', loading: false, error: '', success: '' });
      }, 1500);
    } catch (err) {
      setCreateModal(prev => ({ ...prev, error: err.message }));
    } finally {
      setCreateModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleImpersonate = async (targetUser) => {
    if (!window.confirm(`Switch session to @${targetUser.username} (${targetUser.email})?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/impersonate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('wavy_token', data.token);
        localStorage.setItem('nexchat_token', data.token);
        localStorage.setItem('wavy_user', JSON.stringify(data.user));
        localStorage.setItem('nexchat_user', JSON.stringify(data.user));
        window.location.reload();
      } else {
        alert(data.message || 'Failed to switch user');
      }
    } catch (err) {
      alert(err.message || 'Network error');
    }
  };

  const filteredUsers = usersList.filter(u =>
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-dark-900 border border-slate-700/80 rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-dark-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Super Admin Surveillance & Management Portal</span>
                <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 text-[10px] font-mono font-bold border border-red-500/30">
                  CONFIDENTIAL
                </span>
              </h2>
              <p className="text-xs text-slate-400">Live chat monitoring, user control, and platform audit logs</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                fetchStats();
                fetchConversations();
                fetchUsers();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 p-3 sm:p-4 bg-dark-950/40 border-b border-slate-800 text-xs overflow-y-auto max-h-36 sm:max-h-none">
            <div className="p-2.5 sm:p-3 bg-dark-900 rounded-2xl border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Total Users</div>
              <div className="text-base sm:text-lg font-bold text-white mt-1">{stats.totalUsers}</div>
            </div>
            <div className="p-2.5 sm:p-3 bg-dark-900 rounded-2xl border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Conversations</div>
              <div className="text-base sm:text-lg font-bold text-brand-400 mt-1">{stats.totalConversations}</div>
            </div>
            <div className="p-2.5 sm:p-3 bg-dark-900 rounded-2xl border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Messages</div>
              <div className="text-base sm:text-lg font-bold text-emerald-400 mt-1">{stats.totalMessages}</div>
            </div>
            <div className="p-2.5 sm:p-3 bg-dark-900 rounded-2xl border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Active Meetings</div>
              <div className="text-base sm:text-lg font-bold text-indigo-400 mt-1">{stats.activeMeetings}</div>
            </div>
            <div className="p-2.5 sm:p-3 bg-dark-900 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Banned Users</div>
              <div className="text-base sm:text-lg font-bold text-red-400 mt-1">{stats.bannedUsers}</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-3 sm:px-6 bg-dark-950/20 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('chats');
              setSelectedConvo(null);
            }}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'chats' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live Chat Monitor ({conversations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center space-x-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'users' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management ({usersList.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* TAB 1: LIVE CHAT MONITOR */}
          {activeTab === 'chats' && (
            <div className="flex-1 flex overflow-hidden relative">
              {/* Conversation List Column */}
              <div className={`${selectedConvo ? 'hidden md:flex' : 'flex'} w-full md:w-96 border-r border-slate-800 flex-col overflow-y-auto bg-dark-950/40`}>
                <div className="p-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                  Active User Conversations
                </div>
                {conversations.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">No active conversations found.</div>
                ) : (
                  conversations.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleInspectConversation(c)}
                      className={`p-3.5 border-b border-slate-800/50 cursor-pointer transition flex items-center justify-between ${
                        selectedConvo?.id === c.id ? 'bg-brand-600/15 border-l-4 border-l-brand-500' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-white truncate mb-1">
                          <span className="text-indigo-400">@{c.user1.username}</span>
                          <span className="text-slate-500 text-[10px]">⇄</span>
                          <span className="text-purple-400">@{c.user2.username}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {c.lastMessage?.content || (c.lastMessage?.message_type ? `[${c.lastMessage.message_type}]` : 'Conversation opened')}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {c.streakCount > 0 && (
                          <span className="text-xs font-bold text-orange-400">🔥 {c.streakCount}</span>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.totalMessages} msgs</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Inspector View */}
              <div className={`${selectedConvo ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden bg-dark-900`}>
                {selectedConvo ? (
                  <>
                    <div className="p-3 sm:p-4 border-b border-slate-800 bg-dark-950/40 flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <button
                          onClick={() => setSelectedConvo(null)}
                          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          ←
                        </button>
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono font-bold text-slate-400 block">CONVERSATION #{selectedConvo.id}</span>
                          <span className="text-xs text-slate-300 truncate block">
                            @{selectedConvo.user1.username} & @{selectedConvo.user2.username}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex-shrink-0">
                        Live Spy Active
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {convoMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">No messages in this chat yet.</div>
                      ) : (
                        convoMessages.map(m => (
                          <div key={m.id} className="p-3 rounded-2xl bg-dark-950 border border-slate-800 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-brand-400">
                                {m.sender_name} (@{m.sender_username})
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(m.created_at).toLocaleString()}
                              </span>
                            </div>

                            {/* Message content */}
                            {m.message_type === 'text' && <p className="text-slate-200">{m.content}</p>}
                            {m.message_type === 'voice_note' && (
                              <div className="text-indigo-400 font-mono text-[11px] flex items-center space-x-1">
                                <span>🎤 Voice Note:</span>
                                <a href={m.file_url} target="_blank" rel="noreferrer" className="underline">Listen Audio</a>
                              </div>
                            )}
                            {m.message_type === 'image' && (
                              <div className="mt-2">
                                <img src={m.file_url} alt="Attachment" className="w-48 h-32 object-cover rounded-xl border border-slate-700" />
                              </div>
                            )}
                            {m.message_type === 'video' && (
                              <video src={m.file_url} controls className="w-60 rounded-xl mt-2" />
                            )}
                            {m.message_type === 'meeting_invite' && (
                              <div className="text-purple-400 font-mono">📹 Video Meeting Invite: {m.content}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                    <Eye className="w-12 h-12 text-slate-700 mb-3" />
                    <h4 className="text-white text-sm font-semibold mb-1">Select a Conversation to Monitor</h4>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Choose any active chat from the left panel to inspect live message exchanges between users.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="relative w-72 sm:w-80">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by username, email, name..."
                    className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-xs text-slate-400 font-mono">Showing {filteredUsers.length} users</div>
                  <button
                    onClick={() => setCreateModal({ open: true, name: '', username: '', email: '', password: '', role: 'user', loading: false, error: '', success: '' })}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Joined</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/20 transition">
                        <td className="p-3.5 flex items-center space-x-3">
                          <img
                            src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                            alt={u.username}
                            className="w-8 h-8 rounded-xl object-cover bg-slate-800"
                          />
                          <div>
                            <div className="font-semibold text-white">{u.name}</div>
                            <div className="text-[11px] text-brand-400 font-mono">@{u.username}</div>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono">{u.email}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            u.role === 'admin' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center space-x-1 font-medium ${
                            u.is_banned ? 'text-red-400' : u.status === 'online' ? 'text-emerald-400' : 'text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              u.is_banned ? 'bg-red-500' : u.status === 'online' ? 'bg-emerald-500' : 'bg-slate-600'
                            }`} />
                            <span className="capitalize">{u.is_banned ? 'Banned' : u.status}</span>
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleImpersonate(u)}
                              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition inline-flex items-center"
                              title={`Login directly as @${u.username}`}
                            >
                              <LogIn className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setResetModal({ open: true, user: u, newPassword: '', loading: false, error: '', success: '' })}
                            className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition inline-flex items-center"
                            title={`Reset Password for @${u.username}`}
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {u.role !== 'admin' && (
                            <>
                              <button
                                onClick={() => toggleBan(u.id, u.is_banned)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                                  u.is_banned ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30' : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30'
                                }`}
                              >
                                {u.is_banned ? 'Unban' : 'Ban'}
                              </button>
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition inline-flex items-center"
                                title="Delete user"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Reset Password Modal */}
        {resetModal.open && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-amber-400">
                  <Key className="w-4 h-4" />
                  <h3 className="text-sm font-bold text-white">Reset User Password</h3>
                </div>
                <button
                  onClick={() => setResetModal({ open: false, user: null, newPassword: '', loading: false, error: '', success: '' })}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                Setting new password for <span className="text-brand-400 font-semibold font-mono">@{resetModal.user?.username}</span> ({resetModal.user?.email})
              </div>

              {resetModal.error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetModal.error}</span>
                </div>
              )}
              {resetModal.success && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetModal.success}</span>
                </div>
              )}

              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    placeholder="Enter new password (min 6 chars)"
                    value={resetModal.newPassword}
                    onChange={(e) => setResetModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                  <div className="flex space-x-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setResetModal(prev => ({ ...prev, newPassword: 'password123' }))}
                      className="text-[10px] text-slate-400 hover:text-brand-400 bg-slate-800/60 px-2 py-0.5 rounded"
                    >
                      password123
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetModal(prev => ({ ...prev, newPassword: '123456' }))}
                      className="text-[10px] text-slate-400 hover:text-brand-400 bg-slate-800/60 px-2 py-0.5 rounded"
                    >
                      123456
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModal({ open: false, user: null, newPassword: '', loading: false, error: '', success: '' })}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetModal.loading}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                  >
                    {resetModal.loading ? 'Updating...' : 'Set Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {createModal.open && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-brand-400">
                  <UserPlus className="w-4 h-4" />
                  <h3 className="text-sm font-bold text-white">Create New User Account</h3>
                </div>
                <button
                  onClick={() => setCreateModal({ open: false, name: '', username: '', email: '', password: '', role: 'user', loading: false, error: '', success: '' })}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createModal.error && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createModal.error}</span>
                </div>
              )}
              {createModal.success && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createModal.success}</span>
                </div>
              )}

              <form onSubmit={handleCreateUserSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pinki Sharma"
                      value={createModal.name}
                      onChange={(e) => setCreateModal(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Username handle
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. pinki"
                      value={createModal.username}
                      onChange={(e) => setCreateModal(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') }))}
                      className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. pinki@gmail.com"
                    value={createModal.email}
                    onChange={(e) => setCreateModal(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      required
                      minLength={6}
                      placeholder="e.g. 123456"
                      value={createModal.password}
                      onChange={(e) => setCreateModal(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Role
                    </label>
                    <select
                      value={createModal.role}
                      onChange={(e) => setCreateModal(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModal({ open: false, name: '', username: '', email: '', password: '', role: 'user', loading: false, error: '', success: '' })}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createModal.loading}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                  >
                    {createModal.loading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
