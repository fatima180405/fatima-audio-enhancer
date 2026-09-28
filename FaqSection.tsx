import React from 'react';
import { ShieldCheck, Cpu, HardDrive, CheckCircle2, Zap, HelpCircle } from 'lucide-react';

export const FaqSection: React.FC = () => {
  return (
    <div className="mt-16 pt-12 border-t border-slate-200">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-3">
            <HelpCircle className="w-4 h-4" />
            Hướng Dẫn & Giải Đáp
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Tại sao chọn công cụ chuyển đổi MP3 này?</h2>
          <p className="text-slate-500 text-sm mt-1">Xử lý trực tiếp trên trình duyệt, tốc độ cực nhanh, bảo mật tuyệt đối</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-2">Bảo Mật Quyền Riêng Tư</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tất cả quá trình mã hóa MP3 diễn ra trực tiếp bằng Web Audio API & LAME MP3 trong trình duyệt của bạn. Không một byte âm thanh nào bị lưu hay tải lên máy chủ ngoài.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-2">Tốc Độ Xử Lý Nhanh</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sử dụng hiệu năng đa nhân CPU của thiết bị với thuật toán chia nhỏ khối mã hóa (chunked encoding) giúp xử lý hàng chục file WAV/FLAC lớn mượt mà không bị treo trang.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-2">Hỗ Trợ Đa Định Dạng</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hỗ trợ đầy đủ tất cả định dạng âm thanh phổ biến: .WAV, .OGG, .FLAC, .M4A, .AAC, .WEBM, .AIFF, .WMA, .OPUS mang lại tính linh hoạt cao nhất.
            </p>
          </div>
        </div>

        {/* Detailed FAQ */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
          <div>
            <h4 className="font-bold text-slate-800 text-sm mb-1">Mức Bitrate nào là tốt nhất khi chuyển đổi sang MP3?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>320 Kbps:</strong> Cho chất lượng âm thanh cao nhất (Studio quality), giữ lại hầu hết chi tiết dải tần.<br />
              <strong>192 Kbps:</strong> Mức chuẩn cân bằng hoàn hảo giữa chất lượng âm thanh tốt và dung lượng gọn gàng.<br />
              <strong>128 Kbps:</strong> Tối ưu cho file ghi âm lời nói, bài giảng hoặc tiết kiệm tối đa dung lượng bộ nhớ.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm mb-1">Tôi có thể tăng âm lượng mà không bị rè hay vỡ tiếng không?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Có! Hệ thống tích hợp sẵn <strong>Chống Rè / Vỡ Tiếng (Soft-knee Limiter)</strong> giúp nén mềm các đỉnh dải tần âm thanh. Dù bạn kích âm lượng lên 200%, 300% hay 400% (+12dB), âm thanh vẫn giữ được độ ấm, to rõ và hoàn toàn không bị rè hay xé tiếng. Đồng thời tính năng <strong>Làm Trong Âm Thanh</strong> tự động lọc sạch tiếng ù âm trầm (&lt;80Hz) và tăng độ nét lời thoại.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm mb-1">Tôi có thể điều chỉnh tốc độ âm thanh (ví dụ 0.85x - 0.90x để luyện nghe IELTS) mà không làm đổi giọng nói không?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hoàn toàn được! Công cụ trang bị thuật toán giãn/nén thời gian <strong>SOLA (Synchronized Overlap-Add)</strong> tiên tiến. Bạn có thể giảm nhẹ tốc độ nói xuống mức <strong>0.85x</strong> hoặc <strong>0.90x</strong> (hoặc bất kỳ mức nào từ 0.5x đến 2.0x) cho bài thi IELTS Listening / TOEIC mà <strong>cao độ và chất giọng tự nhiên vẫn được giữ nguyên</strong> (không bị trầm đục ồm ồm như các trình phát thông thường).
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <h4 className="font-bold text-slate-800 text-sm mb-1">Tôi có thể thêm khoảng lặng cho từng file riêng lẻ hoặc gộp 5–10 file với khoảng trống không?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>1. Thêm khoảng lặng cho 1 file:</strong> Ngay tại mỗi file âm thanh, bạn chỉ cần nhấn nút <strong>"Khoảng lặng"</strong> để chọn nhanh 15 giây, 30 giây, 45 giây, 1 phút hoặc tự điền số giây tùy ý chèn vào cuối (hoặc đầu) file. Sau khi chuyển đổi, file MP3 xuất ra sẽ có đúng thời lượng khoảng lặng cần thiết cho bài tập/đề thi.<br />
              <strong>2. Gộp nhiều hơn 2 file (5, 10+ file):</strong> Nhấn <strong>"Gộp File Audio"</strong>, bạn có thể chọn toàn bộ 5–10 file, sắp xếp theo tên A-Z hoặc đảo chiều. Tại mỗi đoạn nối giữa 2 file bất kỳ, bạn có thể chọn khoảng lặng chung hoặc tùy chỉnh số giây riêng biệt sau từng file (ví dụ sau Part 1 nghỉ 30s, sau Part 2 nghỉ 45s, sau Part 3 nghỉ 60s, sau file cuối nghỉ kiểm tra đáp án).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
