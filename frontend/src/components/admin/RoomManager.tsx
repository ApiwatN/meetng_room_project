import React, { useState, useEffect } from 'react';
import config from '@/config';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';

export default function RoomManager() {
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Forms
    const [newRoom, setNewRoom] = useState({ name: '', capacity: 10, facilities: '', imageUrl: '' });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [editingRoom, setEditingRoom] = useState<any | null>(null);
    const [showRoomForm, setShowRoomForm] = useState(false);



    // ... existing useEffect ...

    const fetchRooms = async () => {
        // ... existing fetchRooms code ...
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${config.apiServer}/api/rooms`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRooms(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchRooms();
        const socket = io(config.apiServer);
        socket.on('room_update', fetchRooms);

        return () => {
            socket.disconnect();
        }
    }, []);

    const handleEditRoom = (room: any) => {
        setEditingRoom(room);
        setNewRoom({ name: room.name, capacity: room.capacity, facilities: room.facilities || '', imageUrl: room.imageUrl || '' });
        setSelectedFile(null);
        setShowRoomForm(true);
    };

    const handleToggleMaintenance = async (room: any) => {
        // ... unchanged ...
        const token = localStorage.getItem('token');
        const newStatus = room.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
        try {
            await fetch(`${config.apiServer}/api/rooms/${room.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            fetchRooms();
        } catch (error) { console.error(error); }
    };

    const handleDeleteRoom = async (id: number) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this! All bookings for this room will be deleted.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${config.apiServer}/api/rooms/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                Swal.fire('Error', 'Failed to delete room. Please check server logs.', 'error');
                return;
            }

            await Swal.fire({
                title: 'Deleted!',
                text: 'Room has been deleted.',
                icon: 'success',
                timer: 800,
                showConfirmButton: false
            });
            fetchRooms();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while deleting the room.', 'error');
        }
    };

    const handleCreateOrUpdateRoom = async (e: React.FormEvent) => {
        e.preventDefault();

        if (editingRoom) {
            const result = await Swal.fire({
                title: 'Confirm Update',
                text: 'Do you want to save changes to this room?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Save Changes'
            });
            if (!result.isConfirmed) return;
        }

        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            let imageUrl = newRoom.imageUrl;

            if (selectedFile) {
                const formData = new FormData();
                formData.append('image', selectedFile);

                const uploadRes = await fetch(`${config.apiServer}/api/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    imageUrl = data.url;
                }
            }

            const roomData = { ...newRoom, imageUrl };

            const url = editingRoom
                ? `${config.apiServer}/api/rooms/${editingRoom.id}`
                : `${config.apiServer}/api/rooms`;

            const method = editingRoom ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(roomData)
            });

            if (!res.ok) {
                Swal.fire('Error', 'Failed to save room details.', 'error');
                return;
            }

            await Swal.fire({
                title: editingRoom ? 'Updated!' : 'Created!',
                text: editingRoom ? 'Room details updated successfully.' : 'New room created successfully.',
                icon: 'success',
                timer: 800,
                showConfirmButton: false
            });

            setNewRoom({ name: '', capacity: 10, facilities: '', imageUrl: '' });
            setSelectedFile(null);
            setEditingRoom(null);
            setShowRoomForm(false);
            fetchRooms();

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'An error occurred while saving.', 'error');
        }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Room Management</h2>
                <button
                    onClick={() => { setEditingRoom(null); setNewRoom({ name: '', capacity: 10, facilities: '', imageUrl: '' }); setSelectedFile(null); setShowRoomForm(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                    <span className="text-lg leading-none">+</span> Add Room
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Room Name</th>
                                <th className="px-6 py-4">Capacity</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Facilities</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rooms.map(room => (
                                <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800">
                                        <div className="flex items-center gap-3">
                                            {room.imageUrl ? (
                                                <img src={room.imageUrl.includes('/uploads/') ? `${config.apiServer}/uploads/${room.imageUrl.split('/uploads/')[1]}` : room.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">🏢</div>
                                            )}
                                            {room.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{room.capacity} Seats</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${room.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {room.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{room.facilities || '-'}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleEditRoom(room)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors border border-blue-200">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDeleteRoom(room.id)} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition-colors border border-red-200">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rooms.length === 0 && <div className="p-8 text-center text-slate-400">No rooms found.</div>}
            </div>

            {/* Room Modal */}
            {showRoomForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">{editingRoom ? 'Edit Room' : 'Create Room'}</h3>
                            <button onClick={() => setShowRoomForm(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
                        </div>
                        <form onSubmit={handleCreateOrUpdateRoom} className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Room Name</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    placeholder="e.g. Executive Boardroom"
                                    value={newRoom.name}
                                    required
                                    onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Capacity</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={newRoom.capacity}
                                        required
                                        onChange={e => setNewRoom({ ...newRoom, capacity: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Facilities</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        placeholder="Projector, TV..."
                                        value={newRoom.facilities}
                                        onChange={e => setNewRoom({ ...newRoom, facilities: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Room Image</label>
                                <div className="space-y-3">
                                    {(selectedFile || newRoom.imageUrl) && (
                                        <div className="w-full h-32 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative">
                                            <img
                                                src={selectedFile ? URL.createObjectURL(selectedFile) : (newRoom.imageUrl?.includes('/uploads/') ? `${config.apiServer}/uploads/${newRoom.imageUrl.split('/uploads/')[1]}` : newRoom.imageUrl)}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedFile(null); setNewRoom({ ...newRoom, imageUrl: '' }); }}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors leading-none"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => {
                                            if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    />
                                    <p className="text-xs text-slate-400">Upload an image from your computer to replace the current one.</p>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowRoomForm(false)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">Cancel</button>
                                <button disabled={loading} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-sm">{editingRoom ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
