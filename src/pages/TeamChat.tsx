import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
    Plus, Send, Image as ImageIcon, Mic, MicOff, UserPlus, 
    Trash2, Edit2, Save, FileText, CheckCircle, Users, Search, 
    MessageSquare, Sparkles, X, Loader, ClipboardList, Check, ArrowRight
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { useTranslation } from "react-i18next";

interface Thread {
    id: string;
    title: string;
    canvas_document: string;
    members: string[];
    created_by: string;
    created_at: string;
    updated_at: string;
}

interface Message {
    id: string;
    thread_id: string;
    sender_id: string | null;
    sender_name: string;
    sender_role: string;
    content: string;
    image_url: string | null;
    created_at: string;
}

interface CanvasTask {
    id: string;
    thread_id: string;
    title: string;
    assigned_to: string | null;
    assigned_name: string | null;
    status: 'Pending' | 'Completed';
    created_at: string;
}

interface TeamMember {
    id: string;
    name: string;
    role: string;
    employee_id: string | null;
}

interface Props {
    user: User | null;
}

export default function TeamChat({ user }: Props) {
    const { t } = useTranslation();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [activeThread, setActiveThread] = useState<Thread | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [tasks, setTasks] = useState<CanvasTask[]>([]);
    const [teamUsers, setTeamUsers] = useState<TeamMember[]>([]);
    
    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [inputText, setInputText] = useState('');
    const [askAI, setAskAI] = useState(true);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [activeTab, setActiveTab] = useState<'doc' | 'tasks' | 'members'>('doc');
    const [isEditingDoc, setIsEditingDoc] = useState(false);
    const [editedDocContent, setEditedDocContent] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isRenamingThread, setIsRenamingThread] = useState(false);
    const [renameTitle, setRenameTitle] = useState('');

    // Image attachments
    const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(null);
    const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    // 1. Fetch initial threads and team members
    useEffect(() => {
        if (!user) return;
        fetchThreads();
        fetchTeamUsers();
    }, [user]);

    // 2. Fetch messages & tasks when active thread changes
    useEffect(() => {
        if (!activeThread) {
            setMessages([]);
            setTasks([]);
            return;
        }

        fetchMessages(activeThread.id);
        fetchTasks(activeThread.id);
        setEditedDocContent(activeThread.canvas_document || '');
        setIsEditingDoc(false);

        // --- REALTIME SUBSCRIPTIONS ---
        // Subscribe to messages in this thread
        const msgChannel = supabase.channel(`thread-messages-${activeThread.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'team_chat_messages',
                filter: `thread_id=eq.${activeThread.id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new as Message];
                    });
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                }
            })
            .subscribe();

        // Subscribe to tasks in this thread
        const taskChannel = supabase.channel(`thread-tasks-${activeThread.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'team_chat_tasks',
                filter: `thread_id=eq.${activeThread.id}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTasks(prev => {
                        if (prev.some(item => item.id === payload.new.id)) return prev;
                        return [...prev, payload.new as CanvasTask];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setTasks(prev => prev.map(item => item.id === payload.new.id ? (payload.new as CanvasTask) : item));
                } else if (payload.eventType === 'DELETE') {
                    setTasks(prev => prev.filter(item => item.id !== payload.old.id));
                }
            })
            .subscribe();

        // Subscribe to active thread changes (e.g. title or document updates)
        const threadChannel = supabase.channel(`thread-detail-${activeThread.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'team_chat_threads',
                filter: `id=eq.${activeThread.id}`
            }, (payload) => {
                const updated = payload.new as Thread;
                setActiveThread(updated);
                setThreads(prev => prev.map(item => item.id === updated.id ? updated : item));
                setEditedDocContent(updated.canvas_document || '');
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
            supabase.removeChannel(taskChannel);
            supabase.removeChannel(threadChannel);
        };
    }, [activeThread?.id]);

    // 3. Scroll to bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoadingAI]);

    // 4. Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'zh-CN';

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (text) setInputText(prev => prev + text);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, []);

    // --- DB FETCH FUNCTIONS ---
    const fetchThreads = async () => {
        const { data, error } = await supabase
            .from('team_chat_threads')
            .select('*')
            .order('updated_at', { ascending: false });
        if (!error && data) {
            setThreads(data);
        }
    };

    const fetchTeamUsers = async () => {
        const { data, error } = await supabase
            .from('users_public')
            .select('id, name, role, employee_id')
            .eq('status', 'Active')
            .order('name', { ascending: true });
        if (!error && data) {
            setTeamUsers(data);
        }
    };

    const fetchMessages = async (threadId: string) => {
        const { data, error } = await supabase
            .from('team_chat_messages')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        if (!error && data) {
            setMessages(data);
        }
    };

    const fetchTasks = async (threadId: string) => {
        const { data, error } = await supabase
            .from('team_chat_tasks')
            .select('*')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        if (!error && data) {
            setTasks(data);
        }
    };

    // --- ACTIONS ---
    const handleCreateThread = async () => {
        if (!user) return;
        const newThread = {
            title: t('New conversation ({{var0}})', { var0: new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) }),
            canvas_document: '',
            members: [user.uid],
            created_by: user.uid
        };

        const { data, error } = await supabase
            .from('team_chat_threads')
            .insert(newThread)
            .select()
            .single();

        if (!error && data) {
            setThreads(prev => [data, ...prev]);
            setActiveThread(data);
        } else {
            alert(t('Failed to create new session:') + (error?.message || t('unknown error')));
        }
    };

    const handleDeleteThread = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(t('Are you sure you want to delete this conversation? This operation is irreversible.'))) return;

        const { error } = await supabase
            .from('team_chat_threads')
            .delete()
            .eq('id', id);

        if (!error) {
            setThreads(prev => prev.filter(item => item.id !== id));
            if (activeThread?.id === id) {
                setActiveThread(null);
            }
        } else {
            alert(t('Delete failed:') + error.message);
        }
    };

    const handleRenameThread = async () => {
        if (!activeThread || !renameTitle.trim()) return;

        const { error } = await supabase
            .from('team_chat_threads')
            .update({ title: renameTitle.trim(), updated_at: new Date().toISOString() })
            .eq('id', activeThread.id);

        if (!error) {
            setActiveThread(prev => prev ? { ...prev, title: renameTitle.trim() } : null);
            setThreads(prev => prev.map(item => item.id === activeThread.id ? { ...item, title: renameTitle.trim() } : item));
            setIsRenamingThread(false);
        } else {
            alert(t('Rename failed:') + error.message);
        }
    };

    // Compress & Preview Attached Image
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                // Max width 1024px for chat attachments to save network bandwidth
                if (w > 1024) {
                    h = (1024 / w) * h;
                    w = 1024;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setAttachedImagePreview(dataUrl);
                setAttachedImageBase64(dataUrl.split(',')[1]);
                setIsUploadingImage(false);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleVoiceToggle = () => {
        if (!recognitionRef.current) {
            alert(t('The current browser does not support voice recording, please try using Chrome or Safari.'));
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    // Send Message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!inputText.trim() && !attachedImagePreview) || !activeThread || !user) return;

        setIsLoadingAI(true);
        const textToSend = inputText.trim();
        setInputText('');
        setAttachedImagePreview(null);
        setAttachedImageBase64(null);

        let imageUrl: string | null = null;

        try {
            // 1. Upload image to Storage if present
            if (attachedImageBase64) {
                const fileName = `${user.employeeId || 'chat'}_${Date.now()}.jpg`;
                const blob = await fetch(`data:image/jpeg;base64,${attachedImageBase64}`).then(r => r.blob());

                const { error: uploadErr } = await supabase.storage
                    .from('work-photos')
                    .upload(fileName, blob, { contentType: 'image/jpeg' });

                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage.from('work-photos').getPublicUrl(fileName);
                imageUrl = urlData.publicUrl;
            }

            // 2. Insert user message in database
            const userMsg = {
                thread_id: activeThread.id,
                sender_id: user.uid,
                sender_name: user.name || 'Anonymous',
                sender_role: user.role || 'Guest',
                content: textToSend || (imageUrl ? t('Image attachment sent') : ''),
                image_url: imageUrl
            };

            const { error: dbErr, data: insertedUserMsg } = await supabase
                .from('team_chat_messages')
                .insert(userMsg)
                .select()
                .single();

            if (dbErr) throw dbErr;

            // Touch thread update time
            await supabase.from('team_chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', activeThread.id);

            // 3. Request Gemini AI response if askAI toggle is on
            if (askAI) {
                // Construct slim history for AI context
                // Filter messages to last 15 to stay within prompt limits
                const chatHistoryContext = messages.slice(-15).map(m => ({
                    sender_name: m.sender_name,
                    sender_role: m.sender_role,
                    content: m.content,
                    image_url: m.image_url
                }));
                // Append the current message
                chatHistoryContext.push({
                    sender_name: userMsg.sender_name,
                    sender_role: userMsg.sender_role,
                    content: userMsg.content,
                    image_url: userMsg.image_url
                });

                const aiRequestBody = {
                    query: textToSend || t('Please analyze this photo I sent'),
                    userContext: {
                        role: user.role,
                        name: user.name,
                        email: user.email,
                        uid: user.uid,
                        employeeId: user.employeeId
                    },
                    history: chatHistoryContext,
                    canvas_document: activeThread.canvas_document || '',
                    canvas_tasks: tasks.map(cTask => ({ title: cTask.title, status: cTask.status, assigned_name: cTask.assigned_name })),
                    imageBase64: attachedImageBase64 || undefined,
                    mimeType: 'image/jpeg'
                };

                const res = await fetch('/api/agent/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(aiRequestBody)
                });

                if (!res.ok) throw new Error(t('AI service response error'));

                const data = await res.json();
                let rawAIResponse = data.response || t('I failed to understand the request.');

                // 4. Parse Canvas manipulations from AI response
                // A. Parse Document Updates (handles both <update_doc> and [UPDATE_DOC: ])
                let newDocContent = '';
                const xmlDocRegex = /<update_doc>\s*([\s\S]*?)\s*<\/update_doc>/i;
                const xmlDocMatch = rawAIResponse.match(xmlDocRegex);

                if (xmlDocMatch) {
                    newDocContent = xmlDocMatch[1].trim();
                    rawAIResponse = rawAIResponse.replace(xmlDocRegex, '').trim();
                } else {
                    // Smart fallback for old format [UPDATE_DOC: ...] to avoid bracket nested cut-off
                    const oldDocMarker = '[UPDATE_DOC:';
                    const oldDocStartIndex = rawAIResponse.toUpperCase().indexOf(oldDocMarker.toUpperCase());
                    if (oldDocStartIndex !== -1) {
                        const rawDocContent = rawAIResponse.substring(oldDocStartIndex + oldDocMarker.length);
                        // Clean chat bubble text
                        rawAIResponse = rawAIResponse.substring(0, oldDocStartIndex).trim();
                        
                        // Strip only the trailing tag closing bracket ']'
                        let cleanedDocContent = rawDocContent.trim();
                        if (cleanedDocContent.endsWith(']')) {
                            cleanedDocContent = cleanedDocContent.slice(0, -1).trim();
                        }
                        newDocContent = cleanedDocContent;
                    }
                }

                if (newDocContent) {
                    // Update thread canvas document in DB
                    const { error: docUpdateErr } = await supabase
                        .from('team_chat_threads')
                        .update({ canvas_document: newDocContent, updated_at: new Date().toISOString() })
                        .eq('id', activeThread.id);
                    
                    if (docUpdateErr) console.error("Error saving document:", docUpdateErr);
                }

                // Helper to resolve assignee and insert task
                const handleTaskInsert = async (taskTitle: string, assigneeQuery: string) => {
                    let assignedId: string | null = null;
                    let assignedName: string | null = null;

                    if (assigneeQuery.toLowerCase() !== 'unassigned' && assigneeQuery.toLowerCase() !== t('Not assigned') && assigneeQuery.toLowerCase() !== t('none')) {
                        const resolvedMember = teamUsers.find(u => 
                            u.name.toLowerCase().includes(assigneeQuery.toLowerCase()) || 
                            u.employee_id === assigneeQuery
                        );
                        if (resolvedMember) {
                            assignedId = resolvedMember.id;
                            assignedName = resolvedMember.name;
                        } else {
                            assignedName = assigneeQuery;
                        }
                    }

                    await supabase.from('team_chat_tasks').insert({
                        thread_id: activeThread.id,
                        title: taskTitle,
                        assigned_to: assignedId,
                        assigned_name: assignedName,
                        status: 'Pending'
                    });
                };

                // B. Parse Task Additions: <add_task>Title:Assignee</add_task>
                const xmlTaskRegex = /<add_task>\s*([^:<>\n]+)\s*:\s*([^<>\n]+)\s*<\/add_task>/gi;
                let xmlTaskMatch;
                while ((xmlTaskMatch = xmlTaskRegex.exec(rawAIResponse)) !== null) {
                    await handleTaskInsert(xmlTaskMatch[1].trim(), xmlTaskMatch[2].trim());
                }
                rawAIResponse = rawAIResponse.replace(/<add_task>\s*[\s\S]*?\s*<\/add_task>/gi, '').trim();

                // Fallback Task Additions: [ADD_TASK: Title:Assignee]
                const oldTaskRegex = /\[ADD_TASK:\s*([^:\n\]]+)\s*:\s*([^\]\n]+)\s*\]/gi;
                let oldTaskMatch;
                while ((oldTaskMatch = oldTaskRegex.exec(rawAIResponse)) !== null) {
                    await handleTaskInsert(oldTaskMatch[1].trim(), oldTaskMatch[2].trim());
                }
                rawAIResponse = rawAIResponse.replace(/\[ADD_TASK:\s*[\s\S]*?\]/gi, '').trim();

                // 5. Insert AI message
                const aiMsg = {
                    thread_id: activeThread.id,
                    sender_id: null, // null represents AI
                    sender_name: 'Gemini',
                    sender_role: 'AI',
                    content: rawAIResponse,
                    image_url: null
                };

                const { error: aiDbErr } = await supabase
                    .from('team_chat_messages')
                    .insert(aiMsg);

                if (aiDbErr) throw aiDbErr;
            }

        } catch (err: any) {
            console.error(err);
            // Append error message to chat
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                thread_id: activeThread.id,
                sender_id: null,
                sender_name: 'System',
                sender_role: 'System',
                content: t('⚠️ Error sending message or AI response: {{var0}}', { var0: err.message }),
                image_url: null,
                created_at: new Date().toISOString()
            }]);
        } finally {
            setIsLoadingAI(false);
        }
    };

    // Document Save (manual edit)
    const handleSaveDocument = async () => {
        if (!activeThread) return;
        const { error } = await supabase
            .from('team_chat_threads')
            .update({ canvas_document: editedDocContent, updated_at: new Date().toISOString() })
            .eq('id', activeThread.id);

        if (!error) {
            setIsEditingDoc(false);
        } else {
            alert(t('Failed to save document:') + error.message);
        }
    };

    // Task Add (manual)
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !activeThread) return;

        const { error } = await supabase
            .from('team_chat_tasks')
            .insert({
                thread_id: activeThread.id,
                title: newTaskTitle.trim(),
                status: 'Pending'
            });

        if (!error) {
            setNewTaskTitle('');
        } else {
            alert(t('Failed to add task:') + error.message);
        }
    };

    // Toggle Task status
    const handleToggleTask = async (task: CanvasTask) => {
        const newStatus = task.status === 'Pending' ? 'Completed' : 'Pending';
        const { error } = await supabase
            .from('team_chat_tasks')
            .update({ status: newStatus })
            .eq('id', task.id);
        
        if (error) alert(t('Failed to update task status:') + error.message);
    };

    // Assign Task Assignee
    const handleAssignTask = async (taskId: string, userId: string) => {
        const resolvedUser = teamUsers.find(u => u.id === userId);
        const { error } = await supabase
            .from('team_chat_tasks')
            .update({ 
                assigned_to: userId || null, 
                assigned_name: resolvedUser?.name || null 
            })
            .eq('id', taskId);

        if (error) alert(t('Failed to assign task:') + error.message);
    };

    // Delete Task
    const handleDeleteTask = async (taskId: string) => {
        const { error } = await supabase
            .from('team_chat_tasks')
            .delete()
            .eq('id', taskId);
        if (error) alert(t('Delete task failed:') + error.message);
    };

    // Invite Member to Thread
    const handleInviteMember = async (userId: string) => {
        if (!activeThread) return;
        if (activeThread.members.includes(userId)) return;

        const updatedMembers = [...activeThread.members, userId];
        const { error } = await supabase
            .from('team_chat_threads')
            .update({ members: updatedMembers, updated_at: new Date().toISOString() })
            .eq('id', activeThread.id);

        if (error) alert(t('Failed to invite members:') + error.message);
    };

    // Remove Member from Thread
    const handleRemoveMember = async (userId: string) => {
        if (!activeThread) return;
        const updatedMembers = activeThread.members.filter(m => m !== userId);
        const { error } = await supabase
            .from('team_chat_threads')
            .update({ members: updatedMembers, updated_at: new Date().toISOString() })
            .eq('id', activeThread.id);

        if (error) alert(t('Failed to remove member:') + error.message);
    };

    // Filter threads by search bar
    const filteredThreads = threads.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.canvas_document?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-4rem)] lg:h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans border-t border-white/5 lg:border-t-0">
            {/* 1. LEFT PANEL: Sidebar */}
            <div className="w-80 border-r border-white/5 bg-zinc-950/80 backdrop-blur-md flex flex-col shrink-0">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-white/5 space-y-3">
                    <button
                        onClick={handleCreateThread}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        <Plus size={18} />
                        
                                                {t('Create a new collaborative session')}
                                            </button>
                    
                    {/* Search Bar */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            placeholder={t('Search conversation or document content...')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder-zinc-500"
                        />
                    </div>
                </div>

                {/* Sidebar Conversations List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {filteredThreads.length === 0 ? (
                        <div className="text-center py-10 text-xs text-zinc-600">
                            
                                                        {t('No relevant conversations found')}
                                                    </div>
                    ) : (
                        filteredThreads.map(threadItem => {
                            const isSelected = activeThread?.id === threadItem.id;
                            return (
                                <div
                                    key={threadItem.id}
                                    onClick={() => setActiveThread(threadItem)}
                                    className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                                        isSelected 
                                            ? 'bg-blue-600/10 border border-blue-500/20 text-white font-medium' 
                                            : 'hover:bg-white/5 border border-transparent text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <MessageSquare size={16} className={isSelected ? 'text-blue-400' : 'text-zinc-500'} />
                                        <span className="text-xs truncate">{threadItem.title}</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteThread(threadItem.id, e)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-all"
                                        title={t('Delete session')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 2. RIGHT/CENTER WORKSPACE */}
            {!activeThread ? (
                /* Empty state dashboard */
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-900/10">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/15 mb-6 animate-pulse">
                        <Sparkles size={32} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-white mb-2">{t('Welcome to the team intelligent collaboration room')}</h2>
                    <p className="text-zinc-500 text-sm text-center max-w-md mb-8">
                        
                                                {t('This is a space for teams to have real-time discussions and collaborate on an AI shared canvas. Create a new session on the left or select a session to start.')}
                                            </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                        <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl hover:border-blue-500/30 transition-all">
                            <h4 className="text-white font-bold text-xs flex items-center gap-2 mb-1.5">
                                <ImageIcon size={14} className="text-blue-400" />
                                
                                                                {t('Intelligent recognition of on-site pictures')}
                                                            </h4>
                            <p className="text-zinc-500 text-xxs">{t('Upload photos of raw materials, let AI read the weighing numbers and automatically classify them, and generate test records.')}</p>
                        </div>
                        <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl hover:border-blue-500/30 transition-all">
                            <h4 className="text-white font-bold text-xs flex items-center gap-2 mb-1.5">
                                <ClipboardList size={14} className="text-indigo-400" />
                                
                                                                {t('Chat automatically generates tasks')}
                                                            </h4>
                            <p className="text-zinc-500 text-xxs">{t('Say "Assign so-and-so to cleaning" in the group chat, and AI will automatically generate and assign tasks in the Canvas on the right.')}</p>
                        </div>
                    </div>
                </div>
            ) : (
                /* Dynamic Workspace */
                <div className="flex-1 flex overflow-hidden">
                    {/* CENTER COLUMN: Realtime Chat Stream */}
                    <div className="flex-1 flex flex-col bg-zinc-900/15 h-full relative">
                        {/* Chat Header */}
                        <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-zinc-950/50 backdrop-blur-md shrink-0">
                            {isRenamingThread ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={renameTitle}
                                        onChange={e => setRenameTitle(e.target.value)}
                                        className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                        placeholder={t('Conversation name')}
                                        onKeyDown={e => e.key === 'Enter' && handleRenameThread()}
                                    />
                                    <button onClick={handleRenameThread} className="bg-blue-600 hover:bg-blue-500 p-1.5 rounded-lg text-white">
                                        <Check size={14} />
                                    </button>
                                    <button onClick={() => setIsRenamingThread(false)} className="bg-zinc-800 hover:bg-zinc-700 p-1.5 rounded-lg text-zinc-400">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-white text-sm truncate max-w-[200px] md:max-w-[300px]">
                                        {activeThread.title}
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setRenameTitle(activeThread.title);
                                            setIsRenamingThread(true);
                                        }}
                                        className="text-zinc-500 hover:text-zinc-300 p-1 rounded"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                </div>
                            )}

                            {/* Thread status metadata */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                                        {activeThread.members.length}  {t('members are active')}
                                                                                </span>
                                </div>
                            </div>
                        </div>

                        {/* Message List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="text-center py-20 text-zinc-600 text-xs">
                                    <MessageSquare size={24} className="mx-auto mb-3 opacity-30" />
                                    <span>{t('Welcome to discuss here! You can get AI assistance by @Gemini in a message or by checking “Ask Gemini”.')}</span>
                                </div>
                            ) : (
                                messages.map((m) => {
                                    const isAI = m.sender_role === 'AI';
                                    const isSystem = m.sender_role === 'System';
                                    const isMe = m.sender_id === user?.uid;
                                    
                                    return (
                                        <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] space-y-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                                {/* Meta Info */}
                                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 px-1">
                                                    {!isMe && <span className="font-bold text-zinc-300">{m.sender_name}</span>}
                                                    <span className="font-mono text-zinc-600">({m.sender_role})</span>
                                                    <span className="text-[9px]">
                                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Bubble Body */}
                                                <div className={`p-3.5 rounded-2xl text-xs break-words shadow-sm relative group/bubble ${
                                                    isMe 
                                                        ? 'bg-blue-600 text-white rounded-br-none' 
                                                        : isAI 
                                                            ? 'bg-zinc-900 border border-white/5 text-zinc-200 rounded-bl-none prose prose-invert prose-xs' 
                                                            : isSystem 
                                                                ? 'bg-amber-950/20 border border-amber-500/10 text-amber-300 rounded-lg' 
                                                                : 'bg-zinc-950 text-zinc-300 border border-white/5 rounded-bl-none'
                                                }`}>
                                                    {/* Text content */}
                                                    {isAI ? (
                                                        <ReactMarkdown>{m.content}</ReactMarkdown>
                                                    ) : (
                                                        <p className="whitespace-pre-wrap">{m.content}</p>
                                                    )}

                                                    {/* Image attachment */}
                                                    {m.image_url && (
                                                        <div className="mt-2.5 rounded-xl overflow-hidden border border-white/10 max-w-[240px] cursor-zoom-in">
                                                            <img 
                                                                src={m.image_url} 
                                                                alt={t('Attachment picture')} 
                                                                className="w-full object-cover max-h-[180px] hover:scale-105 transition-all"
                                                                onClick={() => window.open(m.image_url!, '_blank')}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {isLoadingAI && (
                                <div className="flex justify-start w-full">
                                    <div className="bg-zinc-900 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
                                        <Loader size={12} className="animate-spin text-blue-400" />
                                        <span className="text-xxs text-zinc-500">{t('Gemini is analyzing and generating answers...')}</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Attachment Preview Bar */}
                        {attachedImagePreview && (
                            <div className="absolute bottom-20 left-6 p-2.5 bg-zinc-950 border border-white/10 rounded-2xl flex items-center gap-3 z-10 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                                <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10">
                                    <img src={attachedImagePreview} alt={t('To be uploaded')} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-zinc-400">{t('Ready to upload')}</p>
                                    <button 
                                        onClick={() => {
                                            setAttachedImagePreview(null);
                                            setAttachedImageBase64(null);
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300 font-bold mt-0.5"
                                    >
                                        
                                                                                    {t('Cancel attachment')}
                                                                                </button>
                                </div>
                            </div>
                        )}

                        {/* Input Form */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-zinc-950/60 backdrop-blur-md shrink-0 space-y-3">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between text-xs px-1">
                                <div className="flex items-center gap-4">
                                    {/* Ask Gemini Toggle */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={askAI}
                                            onChange={e => setAskAI(e.target.checked)}
                                            className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                                        />
                                        <span className={`text-xxs font-bold flex items-center gap-1 ${askAI ? 'text-blue-400' : 'text-zinc-500'}`}>
                                            <Sparkles size={11} className={askAI ? 'animate-pulse' : ''} />
                                            
                                                                                            {t('Enable Gemini real-time replies')}
                                                                                        </span>
                                    </label>
                                </div>

                                <div className="text-[10px] text-zinc-600">
                                    
                                                                            {t('Press Enter to send message')}
                                                                        </div>
                            </div>

                            {/* TextInput & Action Buttons */}
                            <div className="relative flex items-center gap-2.5">
                                {/* Photo Attach Icon */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingImage}
                                    className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-white/5 transition-all shrink-0 active:scale-95"
                                    title={t('add picture')}
                                >
                                    {isUploadingImage ? <Loader size={16} className="animate-spin text-blue-400" /> : <ImageIcon size={16} />}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageSelect}
                                    accept="image/*"
                                    className="hidden"
                                />

                                {/* Voice Input Button */}
                                <button
                                    type="button"
                                    onClick={handleVoiceToggle}
                                    className={`p-3 rounded-xl border transition-all shrink-0 active:scale-95 ${
                                        isListening
                                            ? 'bg-red-600 text-white border-red-500 animate-pulse scale-105'
                                            : 'bg-zinc-900 text-zinc-400 border-white/5 hover:bg-zinc-800 hover:text-white'
                                    }`}
                                    title={t('Voice recording')}
                                >
                                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                                </button>

                                {/* Input Element */}
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        placeholder={isListening ? t('Recording, please speak...') : t('Type a message to discuss, or send a task description...')}
                                        disabled={isLoadingAI}
                                        className="w-full bg-zinc-900 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-xs focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all text-white placeholder-zinc-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={(!inputText.trim() && !attachedImagePreview) || isLoadingAI}
                                        className="absolute right-2 top-1.5 p-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors"
                                    >
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* RIGHT COLUMN: Interactive Canvas (Markdown Doc, Tasks, Members) */}
                    <div className="w-[380px] lg:w-[460px] border-l border-white/5 bg-zinc-950/80 backdrop-blur-md flex flex-col h-full shrink-0">
                        {/* Canvas Tab Headers */}
                        <div className="h-16 border-b border-white/5 flex items-center bg-zinc-950/40 px-2 justify-between shrink-0">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setActiveTab('doc')}
                                    className={`px-4 py-2 rounded-xl text-xxs font-bold transition-all flex items-center gap-1.5 ${
                                        activeTab === 'doc'
                                            ? 'bg-white/5 text-white shadow-inner'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    <FileText size={13} />
                                    
                                                                            {t('Document canvas (Canvas)')}
                                                                        </button>
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className={`px-4 py-2 rounded-xl text-xxs font-bold transition-all flex items-center gap-1.5 ${
                                        activeTab === 'tasks'
                                            ? 'bg-white/5 text-white shadow-inner'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    <ClipboardList size={13} />
                                    
                                                                            {t('task list')}
                                                                            {tasks.filter(item => item.status === 'Pending').length > 0 && (
                                        <span className="bg-blue-500 text-white font-bold rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                            {tasks.filter(item => item.status === 'Pending').length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('members')}
                                    className={`px-4 py-2 rounded-xl text-xxs font-bold transition-all flex items-center gap-1.5 ${
                                        activeTab === 'members'
                                            ? 'bg-white/5 text-white shadow-inner'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    <Users size={13} />
                                    
                                                                            {t('session member')}
                                                                        </button>
                            </div>
                        </div>

                        {/* Canvas Body Container */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {/* PAGE TAB 1: Document */}
                            {activeTab === 'doc' && (
                                <div className="space-y-4 h-full flex flex-col">
                                    <div className="flex items-center justify-between shrink-0">
                                        <h4 className="text-white font-bold text-xs">{t('Shared workspace documents')}</h4>
                                        {isEditingDoc ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveDocument}
                                                    className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] flex items-center gap-1"
                                                >
                                                    <Save size={12} />
                                                    
                                                                                                            {t('save')}
                                                                                                        </button>
                                                <button
                                                    onClick={() => {
                                                        setEditedDocContent(activeThread.canvas_document || '');
                                                        setIsEditingDoc(false);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[10px]"
                                                >
                                                    
                                                                                                            {t('Cancel')}
                                                                                                        </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditingDoc(true)}
                                                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/5 font-bold text-[10px] flex items-center gap-1"
                                            >
                                                <Edit2 size={12} />
                                                
                                                                                                        {t('Edit document')}
                                                                                                    </button>
                                        )}
                                    </div>

                                    {isEditingDoc ? (
                                        <textarea
                                            value={editedDocContent}
                                            onChange={e => setEditedDocContent(e.target.value)}
                                            className="flex-1 w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-xs text-zinc-100 focus:outline-none focus:border-blue-500/50 resize-none font-mono custom-scrollbar min-h-[300px]"
                                            placeholder={t('Write reports, specifications or test records here (Markdown format supported)...')}
                                        />
                                    ) : (
                                        <div className="flex-1 bg-zinc-900/40 border border-white/5 rounded-2xl p-5 overflow-y-auto custom-scrollbar prose prose-invert prose-sm max-w-none text-zinc-300 min-h-[300px]">
                                            {activeThread.canvas_document ? (
                                                <ReactMarkdown>{activeThread.canvas_document}</ReactMarkdown>
                                            ) : (
                                                <div className="text-center text-zinc-600 text-xs py-20">
                                                    <FileText size={20} className="mx-auto mb-2 opacity-25" />
                                                    <span>{t('The canvas document is empty.')}</span>
                                                    <p className="mt-1 text-xxs">{t('You can edit it directly or let the AI ​​write a transcript based on the chat.')}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PAGE TAB 2: Tasks Checklist */}
                            {activeTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white font-bold text-xs">{t('Session correlation tasks')}</h4>
                                    </div>

                                    {/* Manual Task Add */}
                                    <form onSubmit={handleAddTask} className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={t('Add collaborative to-do tasks (eg: wash the toilet)...')}
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-xxs text-white focus:outline-none focus:border-blue-500/50 placeholder-zinc-600"
                                        />
                                        <button
                                            type="submit"
                                            className="px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold text-xxs"
                                        >
                                            
                                                                                            {t('Add to')}
                                                                                        </button>
                                    </form>

                                    {/* Tasks List */}
                                    <div className="space-y-2">
                                        {tasks.length === 0 ? (
                                            <div className="text-center text-zinc-600 text-xs py-10">
                                                
                                                                                                    {t('There are currently no associated tasks')}
                                                                                                </div>
                                        ) : (
                                            tasks.map(cTask => {
                                                const isCompleted = cTask.status === 'Completed';
                                                return (
                                                    <div 
                                                        key={cTask.id} 
                                                        className={`p-3 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between gap-3 ${
                                                            isCompleted ? 'opacity-55' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            {/* Checkbox */}
                                                            <button 
                                                                onClick={() => handleToggleTask(cTask)}
                                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                                                    isCompleted 
                                                                        ? 'bg-blue-600 border-blue-500 text-white' 
                                                                        : 'border-zinc-700 bg-zinc-950 text-transparent hover:border-zinc-500'
                                                                }`}
                                                            >
                                                                <Check size={10} className="stroke-[3]" />
                                                            </button>

                                                            {/* Text */}
                                                            <div className="min-w-0 flex-1">
                                                                <p className={`text-xs font-bold text-zinc-200 truncate ${isCompleted ? 'line-through text-zinc-500' : ''}`}>
                                                                    {cTask.title}
                                                                </p>
                                                                
                                                                {/* Assignee select */}
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <span className="text-[10px] text-zinc-500">{t('Assigned to:')}</span>
                                                                    <select
                                                                        value={cTask.assigned_to || ''}
                                                                        onChange={e => handleAssignTask(cTask.id, e.target.value)}
                                                                        className="bg-transparent text-[10px] text-blue-400 font-bold border-none p-0 focus:ring-0 focus:outline-none cursor-pointer"
                                                                    >
                                                                        <option value="" className="bg-zinc-950 text-zinc-500">{t('Not assigned')}</option>
                                                                        {teamUsers.map(member => (
                                                                            <option key={member.id} value={member.id} className="bg-zinc-950 text-zinc-300">
                                                                                {member.name} ({member.role})
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Delete button */}
                                                        <button 
                                                            onClick={() => handleDeleteTask(cTask.id)}
                                                            className="text-zinc-600 hover:text-red-400 p-1 rounded"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PAGE TAB 3: Members & Invitations */}
                            {activeTab === 'members' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white font-bold text-xs">{t('Session invitations and management')}</h4>
                                    </div>

                                    {/* Invite Dropdown Selector */}
                                    <div className="bg-zinc-900 border border-white/5 p-3 rounded-xl space-y-2">
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('Invite people into this conversation to discuss:')}</label>
                                        <select
                                            value=""
                                            onChange={e => {
                                                if (e.target.value) {
                                                    handleInviteMember(e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                            className="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-2 text-xxs text-zinc-300 focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="" disabled>{t('Select team members to invite...')}</option>
                                            {teamUsers
                                                .filter(u => !activeThread.members.includes(u.id))
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        ➕ {u.name} ({u.role})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* Current Members List */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">{t('current session member (')}{activeThread.members.length}):</p>
                                        <div className="space-y-1">
                                            {activeThread.members.map(memberId => {
                                                const resolvedMember = teamUsers.find(u => u.id === memberId);
                                                const isCreator = activeThread.created_by === memberId;
                                                
                                                return (
                                                    <div 
                                                        key={memberId} 
                                                        className="p-3 bg-zinc-900/50 border border-white/5 rounded-xl flex items-center justify-between text-xs"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 border border-zinc-700">
                                                                {resolvedMember?.name?.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-zinc-200">{resolvedMember?.name || t('Unknown employee')}</p>
                                                                <p className="text-[9px] text-zinc-500">{resolvedMember?.role || 'Guest'}</p>
                                                            </div>
                                                        </div>
                                                        {isCreator ? (
                                                            <span className="text-[9px] bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 px-2 py-0.5 rounded-full">
                                                                
                                                                                                                                {t('Creator')}
                                                                                                                            </span>
                                                        ) : (
                                                            // Remove button (only allowed for Creator or SuperAdmins)
                                                            (activeThread.created_by === user?.uid || user?.role === 'SuperAdmin') && (
                                                                <button 
                                                                    onClick={() => handleRemoveMember(memberId)}
                                                                    className="text-xxs text-red-400 hover:text-red-300"
                                                                >
                                                                    
                                                                                                                                            {t('Remove')}
                                                                                                                                        </button>
                                                            )
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
