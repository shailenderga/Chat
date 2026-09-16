import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Eye, Users, ChevronUp, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function StoryViewer({ storyGroup, onClose, onStoryDeleted }) {
  const { user, token } = useAuth();
  const [stories, setStories] = useState(storyGroup.stories || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const progressIntervalRef = useRef(null);
  const isOwner = storyGroup.userId === user?.id;
  const currentStory = stories[currentIndex] || {};

  // Auto-record view if viewing someone else's story
  useEffect(() => {
    if (!currentStory?.id || isOwner) return;

    const recordView = async () => {
      try {
        await fetch(`/api/stories/${currentStory.id}/view`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        console.error('Failed to record story view:', e);
      }
    };
    recordView();
  }, [currentStory?.id, isOwner]);

  // Story progress timer
  useEffect(() => {
    setProgress(0);
    clearInterval(progressIntervalRef.current);

    if (isPaused || showViewersDrawer) return;

    const duration = 5000; // 5 seconds per story
    const intervalTime = 50;
    const increment = (intervalTime / duration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(progressIntervalRef.current);
  }, [currentIndex, isPaused, showViewersDrawer, stories.length]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Delete current story
  const handleDeleteStory = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this story?')) return;

    try {
      const res = await fetch(`/api/stories/${currentStory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        if (onStoryDeleted) {
          onStoryDeleted(currentStory.id);
        }

        const remaining = stories.filter(s => s.id !== currentStory.id);
        if (remaining.length === 0) {
          onClose();
        } else {
          setStories(remaining);
          setCurrentIndex(0);
        }
      } else {
        alert('Could not delete story');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Open Seen By / Viewers Drawer
  const handleOpenViewers = async (e) => {
    e.stopPropagation();
    setIsPaused(true);
    setShowViewersDrawer(true);
    setLoadingViewers(true);

    try {
      const res = await fetch(`/api/stories/${currentStory.id}/viewers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewers(data || []);
      }
    } catch (err) {
      console.error('Error fetching viewers:', err);
    } finally {
      setLoadingViewers(false);
    }
  };

  const formatViewedTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none animate-fade-in"
      onMouseDown={() => !showViewersDrawer && setIsPaused(true)}
      onMouseUp={() => !showViewersDrawer && setIsPaused(false)}
      onTouchStart={() => !showViewersDrawer && setIsPaused(true)}
      onTouchEnd={() => !showViewersDrawer && setIsPaused(false)}
    >
      <div className="relative w-full max-w-sm h-full sm:h-[85vh] sm:rounded-3xl bg-dark-900 overflow-hidden shadow-2xl flex flex-col sm:border sm:border-slate-800">
        {/* Story Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex space-x-1.5">
          {stories.map((s, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width: `${idx < currentIndex ? 100 : idx === currentIndex ? progress : 0}%`
                }}
              />
            </div>
          ))}
        </div>

        {/* User Info & Actions Header */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center space-x-2.5">
            <img
              src={storyGroup.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${storyGroup.username}`}
              alt={storyGroup.name}
              className="w-9 h-9 rounded-full border border-white/40 object-cover"
            />
            <div>
              <div className="text-xs font-bold text-white leading-tight">
                {isOwner ? 'Your Story' : storyGroup.name}
              </div>
              <div className="text-[10px] text-slate-300 font-mono">@{storyGroup.username}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Delete Story Button (Only for story author) */}
            {isOwner && (
              <button
                onClick={handleDeleteStory}
                className="p-1.5 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition shadow"
                title="Delete Story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button onClick={onClose} className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Story Content Area */}
        <div className={`flex-1 w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br ${currentStory.bg_gradient || 'from-indigo-600 to-purple-600'}`}>
          {currentStory.media_url ? (
            currentStory.media_type === 'video' ? (
              <video src={currentStory.media_url} autoPlay playsInline muted loop className="max-w-full max-h-full object-contain rounded-2xl" />
            ) : (
              <img src={currentStory.media_url} alt="Story" className="max-w-full max-h-full object-contain rounded-2xl" />
            )
          ) : (
            <div className="text-white font-bold text-xl leading-relaxed text-center px-4 drop-shadow-lg">
              {currentStory.caption}
            </div>
          )}

          {currentStory.media_url && currentStory.caption && (
            <div className="absolute bottom-16 left-4 right-4 bg-black/50 backdrop-blur-md p-3 rounded-2xl text-xs text-white text-center">
              {currentStory.caption}
            </div>
          )}
        </div>

        {/* Seen By Button (Only for Story Owner) */}
        {isOwner && (
          <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center pointer-events-auto">
            <button
              onClick={handleOpenViewers}
              className="px-4 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold flex items-center space-x-2 transition shadow-lg group"
            >
              <Eye className="w-3.5 h-3.5 text-brand-400 group-hover:scale-110 transition" />
              <span>Seen by {currentStory.viewsCount || 0}</span>
              <ChevronUp className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        )}

        {/* Touch / Click Navigation Hotspots */}
        {!showViewersDrawer && (
          <div className="absolute inset-0 z-20 flex">
            <div className="w-1/2 h-full cursor-pointer" onClick={handlePrev} />
            <div className="w-1/2 h-full cursor-pointer" onClick={handleNext} />
          </div>
        )}

        {/* Story Viewers Drawer Modal ("kisne story dekha") */}
        {showViewersDrawer && (
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] z-40 bg-dark-900 border-t border-slate-700/80 rounded-t-3xl p-4 shadow-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-brand-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Viewers ({viewers.length})
                </h4>
              </div>
              <button
                onClick={() => {
                  setShowViewersDrawer(false);
                  setIsPaused(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loadingViewers ? (
                <div className="text-center py-6 text-xs text-slate-500">Loading viewers list...</div>
              ) : viewers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No views yet. Friends who open your story will appear here.
                </div>
              ) : (
                viewers.map((viewer) => (
                  <div key={viewer.id} className="flex items-center justify-between p-2 rounded-xl bg-dark-950/60 border border-slate-800/60">
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={viewer.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${viewer.username}`}
                        alt={viewer.name}
                        className="w-8 h-8 rounded-full bg-slate-800 object-cover"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">{viewer.name}</div>
                        <div className="text-[10px] text-brand-400 font-mono">@{viewer.username}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatViewedTime(viewer.viewed_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
