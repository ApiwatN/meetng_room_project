import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, LineController, BarController } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import config from '@/config';
import { io } from 'socket.io-client';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, LineController, BarController);

export default function DashboardStats() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Usage Comparison Data
    const [usageData, setUsageData] = useState<any>(null);
    const [rawData, setRawData] = useState<any[]>([]);

    useEffect(() => {
        // Set default date range to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    // Socket.IO for real-time updates
    useEffect(() => {
        if (!startDate || !endDate) return;

        const handleRefresh = () => {
            fetchStats();
            fetchUsage();
        };

        const socket = io(config.apiServer);
        socket.on('connect', () => console.log('DashboardStats Connected to websocket'));
        socket.on('booking_created', handleRefresh);
        socket.on('booking_updated', handleRefresh);
        socket.on('booking_deleted', handleRefresh);
        socket.on('room_update', handleRefresh);

        return () => {
            socket.disconnect();
        };
    }, [startDate, endDate]); // Re-connect when filters change to ensure fresh callbacks if needed, though functions depend on state


    const fetchStats = async () => {
        if (!startDate || !endDate) return;

        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            const query = `?startDate=${startDate}&endDate=${endDate}`;
            const res = await fetch(`${config.apiServer}/api/reports/stats${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setStats(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsage = async () => {
        if (!startDate || !endDate) return;

        const token = localStorage.getItem('token');
        try {
            const query = `?startDate=${startDate}&endDate=${endDate}`;
            const res = await fetch(`${config.apiServer}/api/reports/usage${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // transform datasets for Mixed Chart
                const mixedDatasets = data.chartData.datasets.map((ds: any) => {
                    if (ds.label.includes('Avg Duration')) {
                        return {
                            ...ds,
                            type: 'line',
                            yAxisID: 'y1',
                            borderColor: 'rgba(249, 115, 22, 1)', // Orange for line
                            backgroundColor: 'rgba(249, 115, 22, 0.5)',
                            borderWidth: 2,
                            tension: 0.4,
                            pointRadius: 4,
                            order: 1 // On top
                        };
                    }
                    return {
                        ...ds,
                        type: 'bar', // Explicitly set bar
                        yAxisID: 'y',
                        order: 2
                    };
                });

                setUsageData({
                    ...data.chartData,
                    datasets: mixedDatasets
                });
                setRawData(data.rawData);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchStats();
            fetchUsage();
        }
    }, [startDate, endDate]);

    const exportToExcel = (data: any[], filename: string, sheetName: string) => {
        if (!data || !data.length) return;
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}.xlsx`);
    };

    if (loading && !stats) return <div className="p-8 text-center text-slate-500">Loading stats...</div>;
    if (!stats && !loading) return <div className="p-8 text-center text-red-500">Failed to load stats</div>;

    const barData = stats ? {
        labels: stats.popularRooms.map((r: any) => r.name),
        datasets: [
            {
                label: 'Total Bookings',
                data: stats.popularRooms.map((r: any) => r.count),
                backgroundColor: 'rgba(79, 70, 229, 0.6)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                borderRadius: 8,
            },
        ],
    } : { labels: [], datasets: [] };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* Header & Date Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 md:gap-4 bg-white p-3 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800">Dashboard Overview</h2>
                    <p className="text-slate-500 text-xs md:text-sm mt-0.5 md:mt-1">
                        <span className="hidden md:inline">Showing statistics for </span>
                        <span className="font-semibold text-slate-700">{startDate}</span> - <span className="font-semibold text-slate-700">{endDate}</span>
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 md:gap-3 w-full md:w-auto">
                    <span className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wide">Filter:</span>
                    <div className="flex items-center gap-1 md:gap-2 bg-slate-50 p-1 md:p-1.5 rounded-lg border border-slate-200">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs md:text-sm focus:ring-0 p-0.5 md:p-1 text-slate-700 font-medium cursor-pointer outline-none w-[100px] md:w-auto"
                        />
                        <span className="text-slate-400 text-xs font-medium">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs md:text-sm focus:ring-0 p-0.5 md:p-1 text-slate-700 font-medium cursor-pointer outline-none w-[100px] md:w-auto"
                        />
                    </div>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <MetricCard
                    title="Total Rooms"
                    value={stats.totalRooms}
                    icon={<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>}
                    color="emerald"
                />
                <MetricCard
                    title="Total Bookings"
                    value={stats.totalBookings}
                    icon={<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>}
                    color="indigo"
                />
                <MetricCard
                    title="Total Hours"
                    value={`${stats.totalBookingHours} h`}
                    icon={<circle cx="12" cy="12" r="10"></circle>}
                    color="blue"
                    subIcon={<polyline points="12 6 12 12 16 14"></polyline>}
                />
                <MetricCard
                    title="Avg Duration"
                    value={`${stats.averageMeetingDuration} h`}
                    icon={<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>}
                    color="purple"
                />
            </div>

            {/* Room Performance Comparison (Grouped Bar Chart) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Room Performance Comparison</h3>
                        <p className="text-sm text-slate-400">Comparing usage metrics per room (Mixed View)</p>
                    </div>

                    <div className="flex gap-4">
                        <ExportButton onClick={() => exportToExcel(rawData, 'room_performance', 'Performance')} />
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    {usageData ? (
                        <Bar
                            data={usageData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'bottom' },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                    }
                                },
                                scales: {
                                    y: {
                                        type: 'linear',
                                        display: true,
                                        position: 'left',
                                        title: { display: true, text: 'Bookings / Hours' },
                                        beginAtZero: true
                                    },
                                    y1: {
                                        type: 'linear',
                                        display: true,
                                        position: 'right',
                                        title: { display: true, text: 'Avg Duration (h)' },
                                        grid: { drawOnChartArea: false },
                                        beginAtZero: true
                                    }
                                }
                            }}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">Loading comparison data...</div>
                    )}
                </div>
            </div>

            {/* Top Active Users Table */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Top Active Users</h3>
                    <div className="flex gap-2">
                        <ExportButton onClick={() => exportToExcel(stats.topUsers, 'user_stats', 'Users')} label="Export CSV" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-100">
                                <th className="px-4 py-3 font-medium text-sm">Employee ID</th>
                                <th className="px-4 py-3 font-medium text-sm">User</th>
                                <th className="px-4 py-3 font-medium text-sm">Section</th>
                                <th className="px-4 py-3 font-medium text-sm text-right">Bookings</th>
                                <th className="px-4 py-3 font-medium text-sm text-right text-red-500">Cancelled</th>
                                <th className="px-4 py-3 font-medium text-sm text-right">Total Hours</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {stats.topUsers && stats.topUsers.map((user: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{(user as any).employeeId || '-'}</td>
                                    <td className="px-4 py-3 text-slate-700 font-medium">{user.username}</td>
                                    <td className="px-4 py-3 text-slate-500 text-sm">{(user as any).section}</td>
                                    <td className="px-4 py-3 text-slate-700 text-right font-bold">{user.count}</td>
                                    <td className="px-4 py-3 text-red-500 text-right font-medium">{user.cancelledCount || 0}</td>
                                    <td className="px-4 py-3 text-slate-700 text-right">{user.hours} h</td>
                                </tr>
                            ))}
                            {(!stats.topUsers || stats.topUsers.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No user activity found in this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Helper Components
function MetricCard({ title, value, icon, color, subIcon }: any) {
    const colorClasses: any = {
        indigo: 'bg-indigo-50 text-indigo-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-[10px] md:text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <p className="text-xl md:text-3xl font-black text-slate-900 mt-1 md:mt-2">{value}</p>
            </div>
            <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${colorClasses[color] || 'bg-slate-50 text-slate-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                    {subIcon}
                </svg>
            </div>
        </div>
    );
}

function ExportButton({ onClick, label = "Export Excel" }: any) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
            {label}
        </button>
    );
}
