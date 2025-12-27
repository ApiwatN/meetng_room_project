import React, { useState, useEffect } from 'react';
import config from '@/config';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';

export default function UserManager() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Forms
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER', employeeId: '', email: '', section: '', phoneNumber: '', name: '' });
    const [showUserForm, setShowUserForm] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);

    // Reset Password
    const [resettingUser, setResettingUser] = useState<any | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/users`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setUsers(await res.json());
        } catch (error) {
            console.error('Fetch error', error);
        }
    };

    useEffect(() => {
        fetchUsers();
        const socket = io(config.apiServer);
        socket.on('user_update', fetchUsers);
        return () => { socket.disconnect(); };
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newUser)
            });

            if (!res.ok) {
                const data = await res.json();
                Swal.fire('Error', data.error || 'Failed to create user', 'error');
                return;
            }

            setNewUser({ username: '', password: '', role: 'USER', employeeId: '', email: '', section: '', phoneNumber: '', name: '' });
            setShowUserForm(false);
            fetchUsers();
            Swal.fire({ title: 'Success!', icon: 'success', timer: 800, showConfirmButton: false });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while creating user', 'error');
        }
        finally { setLoading(false); }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/users/${editingUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(editingUser)
            });
            if (res.ok) {
                setEditingUser(null);
                fetchUsers();
                Swal.fire({ title: 'Success!', icon: 'success', timer: 800, showConfirmButton: false });
            } else {
                const data = await res.json();
                Swal.fire('Failed', data.error || 'Unable to update user', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while updating', 'error');
        }
        finally { setLoading(false); }
    };

    const handleDeleteUser = async (user: any) => {
        const result = await Swal.fire({
            title: 'Confirm Delete?',
            text: `Are you sure you want to delete user "${user.username}"? All bookings for this user will also be deleted.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchUsers();
                Swal.fire({ title: 'Deleted!', icon: 'success', timer: 800, showConfirmButton: false });
            } else {
                const data = await res.json();
                Swal.fire('Failed', data.error || 'Unable to delete user', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while deleting', 'error');
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resettingUser || !resetPassword) return;

        const result = await Swal.fire({
            title: 'Confirm Reset Password?',
            text: `Are you sure you want to reset the password for "${resettingUser.username}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Reset',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/users/${resettingUser.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ newPassword: resetPassword })
            });

            if (res.ok) {
                setResettingUser(null);
                setResetPassword('');
                Swal.fire({
                    title: 'Success!',
                    text: 'Password has been reset successfully',
                    icon: 'success',
                    timer: 800,
                    showConfirmButton: false
                });
            } else {
                const data = await res.json();
                Swal.fire('Failed', data.error || 'Unable to reset password', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while resetting password', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
                <button
                    onClick={() => { setNewUser({ username: '', password: '', role: 'USER', employeeId: '', email: '', section: '', phoneNumber: '', name: '' }); setShowUserForm(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                    <span className="text-lg leading-none">+</span> Add User
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Section</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800">{u.username}</td>
                                    <td className="px-6 py-4 text-slate-700 font-medium">{(u as any).name || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-slate-600 font-medium font-mono text-xs">{(u as any).employeeId || '-'}</span>
                                            <span className="text-slate-500 text-xs">{(u as any).section || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-sm">{(u as any).email || '-'}</td>
                                    <td className="px-6 py-4 text-slate-600 text-mono">{(u as any).phoneNumber || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingUser({ ...u })}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded transition-colors"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => setResettingUser(u)}
                                                className="text-xs font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1.5 rounded transition-colors"
                                            >
                                                Reset PW
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && <div className="p-8 text-center text-slate-400">No users found.</div>}
            </div>

            {/* User Modal */}
            {showUserForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Add New User</h3>
                            <button onClick={() => setShowUserForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Username</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={newUser.username}
                                        required
                                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Password</label>
                                    <input
                                        type="password"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                        value={newUser.password}
                                        required
                                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Name (Full Name)</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    value={(newUser as any).name}
                                    required
                                    placeholder="e.g. John Doe"
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value } as any)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Employee ID</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={(newUser as any).employeeId}
                                        required
                                        onChange={e => setNewUser({ ...newUser, employeeId: e.target.value } as any)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={(newUser as any).email}
                                        required
                                        onChange={e => setNewUser({ ...newUser, email: e.target.value } as any)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Role</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-medium"
                                        value={newUser.role}
                                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="USER">USER</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Section</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={(newUser as any).section}
                                        onChange={e => setNewUser({ ...newUser, section: e.target.value } as any)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Phone Number</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    value={(newUser as any).phoneNumber || ''}
                                    placeholder="08X-XXX-XXXX"
                                    onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value } as any)}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowUserForm(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Cancel</button>
                                <button disabled={loading} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm">Create User</button>
                            </div>
                        </form>
                    </div >
                </div >
            )
            }

            {/* Reset Password Modal */}
            {
                resettingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Reset Password</h3>
                                <p className="text-sm text-slate-500 mb-4">Set a new temporary password for <span className="font-bold text-slate-700">{resettingUser.username}</span>.</p>

                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 block">New Password</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none font-mono"
                                            placeholder="Enter new password"
                                            value={resetPassword}
                                            onChange={e => setResetPassword(e.target.value)}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setResettingUser(null); setResetPassword(''); }}
                                            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Edit User</h3>
                            <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleEditUser} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Username</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={editingUser.username}
                                        required
                                        onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Role</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={editingUser.role}
                                        onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                                    >
                                        <option value="USER">USER</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Name (Full Name)</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    value={editingUser.name || ''}
                                    placeholder="e.g. John Doe"
                                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Employee ID</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={editingUser.employeeId || ''}
                                        onChange={e => setEditingUser({ ...editingUser, employeeId: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={editingUser.email || ''}
                                        onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Section</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={editingUser.section || ''}
                                        onChange={e => setEditingUser({ ...editingUser, section: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Phone Number</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                        value={editingUser.phoneNumber || ''}
                                        onChange={e => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
