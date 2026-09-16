import React, { useState, useEffect, useRef } from 'react';
import { Smile, Heart, ThumbsUp, Sparkles, Search, X } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗',
      '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🫣',
      '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏',
      '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒',
      '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠',
      '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯',
      '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
      '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👻', '👽'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: ThumbsUp,
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '👊', '✊', '🤛',
      '🤜', '🤞', '✌️', '🫰', '🤟', '🤘', '👌', '🤌', '🤏', '👈',
      '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '✍️',
      '💅', '🤳', '💪', '🦵', '🦶', '👂', '👃', '🧠', '🫀', '🫁',
      '🫂', '👤', '👥', '💃', '🕺', '🏃', '🚶', '🤸', '🧘', '🏄'
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
      '💋', '🔥', '✨', '🌟', '💫', '💥', '💢', '💯', '🌸', '🌹'
    ]
  },
  {
    id: 'fun',
    name: 'Party',
    icon: Sparkles,
    emojis: [
      '🎉', '🎊', '🎂', '🎈', '🍾', '🥂', '🍻', '🍺', '☕', '🧋',
      '🍕', '🍔', '🍟', '🌮', '🍦', '🍿', '🍫', '🍬', '🍩', '🍓',
      '🥑', '🌶️', '🚀', '✈️', '🚗', '🏍️', '🎮', '🎲', '🎧', '🎵',
      '🎶', '🎤', '📷', '📱', '💻', '💡', '💸', '💰', '🏆', '🥇'
    ]
  }
];

const POPULAR_EMOJIS = ['😂', '❤️', '🔥', '👍', '🥰', '😍', '😭', '✨', '🙏', '🎉', '👏', '🥺'];

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeTab, setActiveTab] = useState('smileys');
  const [search, setSearch] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0];

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, index, self) => self.indexOf(emoji) === index)
    : currentCategory.emojis;

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-16 left-2 sm:left-4 z-50 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!search && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/5 scrollbar-none">
          {POPULAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              type="button"
              className="w-7 h-7 flex items-center justify-center text-lg hover:scale-125 hover:bg-white/10 rounded-lg transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {!search && (
        <div className="flex items-center justify-between border-b border-white/5 pb-1">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/10">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center text-xl hover:scale-125 hover:bg-white/10 rounded-lg transition-all active:scale-95"
          >
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-slate-400">
            No emojis found
          </div>
        )}
      </div>
    </div>
  );
}
