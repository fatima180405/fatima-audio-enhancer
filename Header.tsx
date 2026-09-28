import React from 'react';
import { Music, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface HeaderProps {
  totalFiles: number;
  completedFiles: number;
}

export const Header: React.FC<HeaderProps> = ({ totalFiles, completedFiles }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Audio to MP3</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                PRO 320Kbps
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Chuyển đổi âm thanh WAV, OGG, FLAC, M4A sang MP3 miễn phí
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {totalFiles > 0 && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Đã xong: <strong className="text-indigo-600">{completedFiles}</strong> / {totalFiles}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">100% Bảo mật trên Trình duyệt</span>
            <span className="sm:hidden">100% Bảo mật</span>
          </div>
        </div>
      </div>
    </header>
  );
};
