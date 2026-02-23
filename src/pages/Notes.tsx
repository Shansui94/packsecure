
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Note } from '../types';
import { Plus, Tag, Search, Trash2, Edit2, Lock, Unlock, FileText, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';


const Notes: React.FC<{ user: any }> = ({ user }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    useEffect(() => {
        fetchNotes();
        // Realtime subscription
        const channel = supabase.channel('notes-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (_payload) => {
                fetchNotes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchNotes = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('notes')
                .select(`
                    *,
                    author:users_public!created_by(name)
                `)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedNotes: Note[] = data.map((n: any) => ({
                    ...n,
                    author_name: n.author?.name || 'Unknown'
                }));
                setNotes(mappedNotes);
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        if (!title.trim()) return alert('Title is required');

        const tagList = tags.split(',').map(t => t.trim()).filter(t => t);

        const noteData = {
            title,
            content,
            tags: tagList,
            is_public: isPublic,
            created_by: user.uid,
            updated_at: new Date().toISOString()
        };

        try {
            if (selectedNote && selectedNote.id) {
                // Update
                const { error } = await supabase
                    .from('notes')
                    .update(noteData)
                    .eq('id', selectedNote.id);
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('notes')
                    .insert(noteData);
                if (error) throw error;
            }
            setIsEditing(false);
            setSelectedNote(null);
            clearForm();
        } catch (error: any) {
            alert('Error saving note: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this note?')) return;
        try {
            const { error } = await supabase.from('notes').delete().eq('id', id);
            if (error) throw error;
            if (selectedNote?.id === id) setSelectedNote(null);
        } catch (error: any) {
            alert('Error deleting note: ' + error.message);
        }
    };

    const clearForm = () => {
        setTitle('');
        setContent('');
        setTags('');
        setIsPublic(false);
    };

    const startEdit = (note?: Note) => {
        if (note) {
            setSelectedNote(note);
            setTitle(note.title);
            setContent(note.content);
            setTags(note.tags?.join(', ') || '');
            setIsPublic(note.is_public);
        } else {
            setSelectedNote(null); // New Note Mode
            clearForm();
        }
        setIsEditing(true);
    };

    const filteredNotes = notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="h-full flex overflow-hidden bg-[#121215] text-gray-200">
            {/* Sidebar List */}
            <div className="w-80 border-r border-white/5 flex flex-col bg-[#16161a]">
                <div className="p-4 border-b border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileText size={24} className="text-blue-500" /> Notes
                        </h2>
                        <button
                            onClick={() => startEdit()}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search notes or tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0a0a0c] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No notes found. Create one!</div>
                    ) : (
                        <div className="space-y-1 p-2">
                            {filteredNotes.map(note => (
                                <button
                                    key={note.id}
                                    onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                                    className={`w-full text-left p-3 rounded-lg transition-all ${selectedNote?.id === note.id ? 'bg-blue-500/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <h3 className={`font-bold text-sm truncate ${selectedNote?.id === note.id ? 'text-blue-400' : 'text-gray-300'}`}>{note.title}</h3>
                                    <p className="text-xs text-gray-500 mt-1 truncate">{note.content}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                            <span>{new Date(note.updated_at || '').toLocaleDateString()}</span>
                                            {note.is_public ? <Unlock size={10} className="text-green-500" /> : <Lock size={10} />}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full bg-[#121215]">
                {isEditing ? (
                    // EDIT MODE
                    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">{selectedNote ? 'Edit Note' : 'New Note'}</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all">Save Note</button>
                            </div>
                        </div>

                        <div className="space-y-4 flex-1 flex flex-col">
                            <input
                                type="text"
                                placeholder="Note Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent text-3xl font-bold text-white placeholder-gray-600 border-b border-white/10 pb-2 focus:outline-none focus:border-blue-500 transition-colors"
                            />

                            <div className="flex gap-4">
                                <div className="flex-1 bg-[#1a1a1e] rounded-lg p-2 border border-white/10 flex items-center gap-2">
                                    <Tag size={16} className="text-gray-500 ml-2" />
                                    <input
                                        type="text"
                                        placeholder="Tags (comma separated)..."
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        className="bg-transparent w-full text-sm focus:outline-none text-gray-300 placeholder-gray-600"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsPublic(!isPublic)}
                                    className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-bold transition-colors ${isPublic ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-[#1a1a1e] border-white/10 text-gray-400 hover:text-white'}`}
                                >
                                    {isPublic ? <Unlock size={16} /> : <Lock size={16} />}
                                    {isPublic ? 'Public' : 'Private'}
                                </button>
                            </div>

                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Start writing..."
                                className="flex-1 w-full bg-[#1a1a1e] rounded-xl border border-white/10 p-6 text-gray-300 resize-none focus:outline-none focus:border-blue-500/50 transition-colors font-mono custom-scrollbar text-sm leading-relaxed"
                            />
                        </div>
                    </div>
                ) : selectedNote ? (
                    // VIEW MODE
                    <div className="flex-1 overflow-y-auto p-8 animate-fade-in custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-between items-start border-b border-white/5 pb-6">
                                <div>
                                    <h1 className="text-4xl font-bold text-white mb-3">{selectedNote.title}</h1>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                        <span className="flex items-center gap-1 text-blue-400"><User size={14} /> {selectedNote.author_name}</span>
                                        <span>•</span>
                                        <span>{new Date(selectedNote.updated_at || '').toLocaleString()}</span>
                                        {selectedNote.is_public && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-green-500"><Unlock size={14} /> Public</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {(user?.uid === selectedNote.created_by || user?.role === 'SuperAdmin') && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(selectedNote)}
                                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedNote.id)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedNote.tags && selectedNote.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedNote.tags.map((tag, i) => (
                                        <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400 font-medium">#{tag}</span>
                                    ))}
                                </div>
                            )}

                            <div className="prose prose-invert max-w-none text-gray-300">
                                <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ) : (
                    // EMPTY STATE
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <FileText size={48} className="text-slate-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-400 mb-2">Select a Note</h2>
                        <p className="max-w-md text-center text-sm">Choose a role from the sidebar or categorize your thoughts by creating a new note.</p>
                        <button
                            onClick={() => startEdit()}
                            className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-1"
                        >
                            <Plus size={20} /> Create New Note
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notes;
