import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface ActivityLog {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: string;
    action: string;
    details: any;
    created_at: string;
}

interface ActivityLogsProps {
    user: User | null;
}

const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterUser, setFilterUser] = useState<string>('all');
    const [usersList, setUsersList] = useState<{ id: string, name: string, email: string }[]>([]);

    useEffect(() => {
        if (!user) return;
        fetchLogs();
        if (user.role === 'SuperAdmin') {
            fetchUsersList();
        }
    }, [user, filterUser]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('user_activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            // RLS automatically filters so we only need to specifically filter when SuperAdmin wants to see a specific user
            if (user?.role === 'SuperAdmin' && filterUser !== 'all') {
                query = query.eq('user_id', filterUser);
            }

            const { data, error } = await query;
            if (error) {
                console.error("Error fetching logs:", error);
            } else if (data) {
                setLogs(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsersList = async () => {
        try {
             const { data, error } = await supabase.from('sys_users_v2').select('auth_user_id, name, email');
             if (!error && data) {
                 setUsersList(data.map(d => ({ id: d.auth_user_id, name: d.name, email: d.email })));
             }
        } catch (err) {}
    }

    if (!user) return <div className="p-8">Please log in to view logs.</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">System Activity Logs</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {user.role === 'SuperAdmin' ? 'View all user actions and system events.' : 'View your personal system actions.'}
                    </p>
                </div>
                
                {user.role === 'SuperAdmin' && (
                    <div className="flex items-center gap-3">
                        <select 
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none transition-all shadow-sm"
                        >
                            <option value="all">All Users</option>
                            {usersList.map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                        <button 
                            onClick={fetchLogs}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                        >
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle text-gray-500">
                        <thead className="text-xs text-gray-600 uppercase bg-gray-50/80 backdrop-blur border-b border-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Timestamp</th>
                                {user.role === 'SuperAdmin' && <th scope="col" className="px-6 py-4 font-semibold tracking-wider">User</th>}
                                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Action</th>
                                <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={user.role === 'SuperAdmin' ? 4 : 3} className="px-6 py-12 text-center text-gray-400">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div>
                                            <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse delay-75"></div>
                                            <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse delay-150"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={user.role === 'SuperAdmin' ? 4 : 3} className="px-6 py-12 text-center text-gray-500">
                                        No activity logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="bg-white border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                                            {new Date(log.created_at).toLocaleString('en-GB', { 
                                                day: '2-digit', month: 'short', year: 'numeric', 
                                                hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                            })}
                                        </td>
                                        {user.role === 'SuperAdmin' && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-gray-900">{log.name || 'Unknown'}</div>
                                                <div className="text-xs text-gray-400">{log.email}</div>
                                                <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                    {log.role}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold
                                                ${log.action === 'PAGE_VIEW' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                                  log.action === 'LOGIN' ? 'bg-green-50 text-green-700 border border-green-100' :
                                                  log.action === 'LOGOUT' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                  log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                  log.action.includes('UPDATE') || log.action.includes('EDIT') ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                  log.action === 'ERROR' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                  'bg-slate-50 text-slate-700 border border-slate-200'
                                                }
                                            `}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500 max-w-md overflow-hidden text-ellipsis">
                                            {log.details ? JSON.stringify(log.details) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogs;
