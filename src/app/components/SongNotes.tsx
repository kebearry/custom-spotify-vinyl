"use client";

import { useState, useEffect, useCallback } from "react";

interface Reaction {
  emoji: string;
  count: number;
  users: string[]; // Array of userIds who reacted
}

interface Note {
  _id: string;
  content: string;
  timestamp: string;
  userId: string;
  reactions: {
    [key: string]: Reaction; // emoji as key
  };
}

interface SongNotesProps {
  trackId: string;
  trackName: string;
}

const AVAILABLE_REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "😢", label: "Sad" },
  { emoji: "🥺", label: "Pleading" },
  { emoji: "😠", label: "Angry" },
  { emoji: "✨", label: "Sparkles" },
];

export default function SongNotes({ trackId, trackName }: SongNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/notes?trackId=${trackId}`);
      if (!response.ok) throw new Error("Failed to fetch notes");

      const data = await response.json();
      setNotes(data.notes);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    fetchNotes();
  }, [trackId, fetchNotes]);

  useEffect(() => {
    // Get or create userId from localStorage
    let id = localStorage.getItem("userId");
    if (!id) {
      id = Math.random().toString(36).substr(2, 9);
      localStorage.setItem("userId", id);
    }
    setUserId(id);
  }, []);

  const addNote = async () => {
    if (!newNote.trim()) return;

    const note = {
      content: newNote.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId,
          note,
          isShared: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to save note");

      await fetchNotes();
      setNewNote("");
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  const toggleReaction = async (noteId: string, emoji: string) => {
    try {
      const response = await fetch("/api/notes/react", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId,
          emoji,
          userId,
        }),
      });

      if (!response.ok) throw new Error("Failed to react to note");

      const updatedNote = await response.json();
      setNotes(
        notes.map((note) =>
          note._id === noteId
            ? { ...note, reactions: updatedNote.reactions }
            : note
        )
      );
    } catch (error) {
      console.error("Failed to react:", error);
    }
  };

  return (
    <div className="w-[500px] mt-2 bg-slate-900/95 rounded-lg border border-sky-400/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-3 flex items-center justify-between text-sky-200/80 hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-sm font-medium">Shared Notes</span>
        <svg
          className={`w-5 h-5 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-sky-400/20">
          {/* Add Note */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a shared note about this song..."
              className="flex-1 px-3 py-2 bg-slate-800/50 rounded-md border border-sky-400/20 text-sky-100 placeholder-sky-400/50 focus:outline-none focus:border-sky-400/50"
              onKeyDown={(e) => {
                if (e.key === "Enter") addNote();
              }}
            />
            <button
              onClick={addNote}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md transition-colors"
            >
              Share
            </button>
          </div>

          {/* Notes List with Reactions */}
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sky-400/50 text-sm text-center py-4">
                Loading notes...
              </p>
            ) : notes.length === 0 ? (
              <p className="text-sky-400/50 text-sm text-center py-4">
                {`No shared notes yet for ${trackName}`}
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note._id}
                  className="bg-slate-800/30 rounded-md p-4 space-y-2"
                >
                  <p className="text-sky-100">{note.content}</p>
                  <div className="text-sky-400/50 text-xs">
                    Shared on {new Date(note.timestamp).toLocaleDateString()} at{" "}
                    {new Date(note.timestamp).toLocaleTimeString()}
                  </div>

                  {/* Reactions Display - Updated styling */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pb-1">
                    {AVAILABLE_REACTIONS.map(({ emoji, label }) => {
                      const reaction = note.reactions?.[emoji] || {
                        count: 0,
                        users: [],
                      };
                      const hasReacted = reaction.users.includes(userId);

                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(note._id, emoji)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                            hasReacted
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title={label}
                        >
                          <span className="text-base leading-none">
                            {emoji}
                          </span>
                          {reaction.count > 0 && (
                            <span className="font-medium">
                              {reaction.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
