import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, X, Image as ImageIcon, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StoryViewer from './StoryViewer';

export default function StoryTray() {
  const { user, token } = useAuth();
  const [storyGroups, setStoryGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [storyType, setStoryType] = useState('text'); // 'text' or 'image'
  const [caption, setCaption] = useState('');
  const [bgGradient, setBgGradient] = useState('from-indigo-600 to-purple-600');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gradients = [
    'from-indigo-600 to-purple-600',
    'from-pink-600 to-rose-600',
    'from-emerald-600 to-teal-700',
    'from-amber-500 to-orange-600',
    'from-blue-600 to-cyan-600',
    'from-violet-700 to-fuchsia-600'
  ];

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const res = await fetch('/api/stories', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStoryGroups(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setStoryType(file.type.startsWith('video') ? 'video' : 'image');
    }
  };

  const handlePostStory = async () => {
    if (storyType === 'text' && !caption.trim()) {
      alert('Please enter some text for your story');
      return;
    }

    setIsSubmitting(true);
    try {
      let mediaUrl = null;

      // Upload media if present
      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        const uploadRes = await fetch('/api/chats/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          mediaUrl = uploadData.fileUrl;
        }
      }

      // Create story
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mediaType: storyType,
          mediaUrl,
          caption: caption.trim(),
          bgGradient
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setCaption('');
        setMediaFile(null);
        setMediaPreview(null);
        fetchStories();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find current user's stories if any
  const myStories = storyGroups.find(g => g.userId === user?.id);

  return (
    <>
      <div className="flex items-center space-x-3 overflow-x-auto py-2 px-1 scrollbar-none">
        {/* Your Story (+) Button */}
        <div className="flex flex-col items-center flex-shrink-0 group">
          <div className="relative">
            {myStories ? (
              /* User has active stories: colorful ring, clicking opens StoryViewer */
              <div
                onClick={() => setSelectedGroup(myStories)}
                className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-brand-500 to-indigo-500 hover:scale-105 transition cursor-pointer shadow-md"
                title="View your story and see who viewed it"
              >
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                  alt="You"
                  className="w-full h-full rounded-full object-cover border-2 border-dark-950 bg-slate-900"
                />
              </div>
            ) : (
              /* No active stories: dashed ring, clicking opens create modal */
              <div
                onClick={() => setShowCreateModal(true)}
                className="w-14 h-14 rounded-full p-0.5 border-2 border-dashed border-brand-500/60 hover:border-brand-400 transition cursor-pointer flex items-center justify-center bg-dark-900"
                title="Add to your story"
              >
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
                  alt="You"
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
            )}

            {/* Add Story (+) button */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateModal(true);
              }}
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-600 hover:bg-brand-500 rounded-full border-2 border-dark-950 flex items-center justify-center text-white text-xs font-bold shadow-md cursor-pointer transition"
              title="Add new story"
            >
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-300 mt-1 max-w-[60px] truncate text-center">
            {myStories ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Other Users' Stories */}
        {storyGroups.filter(g => g.userId !== user?.id).map((group) => (
          <div
            key={group.userId}
            onClick={() => setSelectedGroup(group)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
          >
            <div className={`w-14 h-14 rounded-full p-0.5 transition shadow-md group-hover:scale-105 ${
              group.hasUnviewed
                ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-500'
                : 'border-2 border-slate-700 bg-slate-800'
            }`}>
              <img
                src={group.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${group.username}`}
                alt={group.name}
                className="w-full h-full rounded-full object-cover border-2 border-dark-950 bg-slate-900"
              />
            </div>
            <span className="text-[11px] font-medium text-slate-300 mt-1 max-w-[65px] truncate text-center">
              {group.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* Story Viewer Modal */}
      {selectedGroup && (
        <StoryViewer
          storyGroup={selectedGroup}
          onClose={() => {
            setSelectedGroup(null);
            fetchStories();
          }}
          onStoryDeleted={() => {
            fetchStories();
          }}
        />
      )}

      {/* Create Story Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Create 24h Story</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">Visible to your friends for 24 hours</p>

            {/* Story Preview Card */}
            <div className={`w-full h-64 rounded-2xl bg-gradient-to-br ${bgGradient} p-4 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner mb-4`}>
              {mediaPreview ? (
                storyType === 'video' ? (
                  <video src={mediaPreview} autoPlay muted loop className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                )
              ) : (
                <div className="text-white font-bold text-lg px-3 drop-shadow-md">
                  {caption || 'Type your story caption below...'}
                </div>
              )}
            </div>

            {/* Gradient Selector */}
            {!mediaPreview && (
              <div className="flex items-center justify-center space-x-2 mb-4">
                {gradients.map((grad, i) => (
                  <button
                    key={i}
                    onClick={() => setBgGradient(grad)}
                    className={`w-6 h-6 rounded-full bg-gradient-to-br ${grad} border-2 transition ${
                      bgGradient === grad ? 'border-white scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Caption Input */}
            <div className="mb-4">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                maxLength={120}
                className="w-full bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Media Upload and Post */}
            <div className="flex items-center space-x-2">
              <label className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition flex items-center space-x-1.5 text-xs font-medium border border-slate-700">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Photo/Video</span>
                <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              </label>

              <button
                onClick={handlePostStory}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-brand-600/30 flex items-center justify-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Posting...' : 'Share to Story'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
