import React from 'react';
import { Music } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-8 mt-16 text-slate-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
            <Music className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-800">Chuyển Đổi Âm Thanh MP3</span>
          <span>© {new Date().getFullYear()}</span>
        </div>

        <p className="text-center sm:text-right">
          Công cụ chuyển đổi âm thanh trực tuyến nhanh chóng, bảo mật và miễn phí 100%.
        </p>
      </div>
    </footer>
  );
};
