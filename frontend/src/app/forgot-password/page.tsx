'use client';

import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="w-full max-w-sm bg-white border border-slate-200 shadow-sm rounded-xl p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>

                <h1 className="text-xl font-bold text-slate-900 mb-2">Forgot Password?</h1>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Please contact the System Administrator to reset your password.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Admin Contact</p>
                    <p className="text-sm font-semibold text-slate-800">IT Department</p>
                    <p className="text-sm text-slate-600">Ext. 1000</p>
                </div>

                <button
                    onClick={() => router.back()}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                >
                    ← Back to Login
                </button>
            </div>
        </div>
    );
}
