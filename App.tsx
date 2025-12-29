
import { useState, useEffect, useRef, type FC } from 'react';
// BẮT BUỘC: Thêm đuôi .ts để tránh lỗi nạp file
import { WebhookStep, UserAnswers, PhaseResponse } from './types.ts';

/**
 * ============================================================
 * CẤU HÌNH TÙY CHỈNH CHO NGƯỜI DÙNG - CHỈNH SỬA TỪNG HẰNG SỐ DƯỚI ĐÂY
 * ============================================================
 */
// URL ảnh GIF avatar - có thể thay đổi URL hoặc ID ảnh ở Cloudinary
const AVATAR_GIF = "https://res.cloudinary.com/dj779f2vh/image/upload/v1763972823/%E1%BA%A2nh_c%C3%B4_C%C3%B4ng_an_a0on68.gif";
// Webhook URL để gửi dữ liệu khảo sơ & quét trang - THAY ĐỔI TẠI ĐÂY khi chuyển server mới
const DEFAULT_WEBHOOK = 'https://wf.antoan.site/webhook/dvc-assistant';
// Thời gian chờ giữa các bước tự động (ms) - tăng = chậm hơn, giảm = nhanh hơn
const EXECUTION_DELAY = 1200;
/**
 * ============================================================
 */

type AppStatus = 'IDLE' | 'SURVEY' | 'INIT_SENDING' | 'SCANNING' | 'READY_EXECUTE' | 'EXECUTING' | 'ACTION_DONE' | 'WAITING_CONFIRM' | 'SUCCESS' | 'ERROR';

const getBrowserApi = () => {
  if (typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.runtime) return (window as any).chrome;
  if (typeof window !== 'undefined' && (window as any).browser && (window as any).browser.runtime) return (window as any).browser;
  return null;
};

const App: FC = () => {
  const [status, setStatus] = useState<AppStatus>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK);
  const [parsedSteps, setParsedSteps] = useState<WebhookStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phaseData, setPhaseData] = useState<{ guide: string, requireConfirm: boolean, currentPhase: string | null }>({
    guide: "Bác hãy làm theo hướng dẫn bên dưới nhé.",
    requireConfirm: false,
    currentPhase: null
  });
  
  // State lưu trữ câu trả lời khảo sơ - các giá trị này được gửi kèm webhook khi khởi tạo
  const [answers, setAnswers] = useState<UserAnswers>({
    target: 'SELF',           // Chính chủ (SELF) hoặc Khai hộ (BEHALF)
    documentType: 'CCCD',     // Loại giấy tờ: CCCD hoặc CMND
    idNumber: null as any,    // Số CCCD/ID (để null - trường này đã ẩn)
    agencyLevel: 'COMMUNE',   // Nơi thực hiện: COMMUNE (xã) hoặc PROVINCE (tỉnh)
    deliveryMethod: 'APP'     // Hình thức nhận kết quả: APP, DIRECT, POST
  });

  const scanResolver = useRef<((data: any) => void) | null>(null);
  const stepResolver = useRef<((success: boolean) => void) | null>(null);
  const api = getBrowserApi();

  useEffect(() => {
    if (!sessionId) {
       setSessionId('sess_' + Math.random().toString(36).substr(2, 9));
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "DVC_SCAN_RESULT") scanResolver.current?.(event.data.data);
      if (event.data.type === "DVC_STEP_RESULT") stepResolver.current?.(event.data.success);
    };
    window.addEventListener("message", handleMessage);
    
    if (api?.storage) {
      api.storage.local.get(['dvc_session_state'], (data: any) => {
        if (data.dvc_session_state) {
          const s = data.dvc_session_state;
          const restoredStatus = s.status === 'EXECUTING' ? 'ACTION_DONE' : s.status;
          setStatus(restoredStatus);
          setSessionId(s.sessionId);
          setAnswers(s.answers);
          setParsedSteps(s.parsedSteps);
          setPhaseData(s.phaseData);
          setCurrentStepIndex(s.currentStepIndex || 0);
        }
      });
    }

    const storedUrl = localStorage.getItem('dvc_webhook_url');
    if (storedUrl) setWebhookUrl(storedUrl);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (api?.storage && status !== 'IDLE') {
      api.storage.local.set({
        dvc_session_state: { status, sessionId, answers, parsedSteps, phaseData, currentStepIndex }
      });
    }
  }, [status, sessionId, answers, parsedSteps, phaseData, currentStepIndex]);

  /**
   * BỘ ĐIỀU PHỐI THÔNG MINH (Smart Dispatcher)
   * Phân tích dữ liệu response từ webhook - hỗ trợ nhiều định dạng
   * Trích xuất: guide message, phase name, danh sách actions
   */
  const processResponse = (data: any) => {
    let root = data;
    if (Array.isArray(data) && data.length > 0) root = data[0];

    // Giá trị mặc định nếu server không trả
    let steps: WebhookStep[] = [];
    let guide = "Bác hãy làm theo hướng dẫn bên dưới nhé.";
    let confirm = false;
    let phase = null;

    if (root && typeof root === 'object') {
      // Trích xuất thông tin từ response webhook
      phase = root.current_phase || null;                    // Phase hiện tại
      guide = root.guide_message || root.guide || guide;    // Hướng dẫn cho người dùng
      confirm = root.require_confirmation === true;         // Có cần xác nhận sau khi thực thi

      const potentialActions = root.actions || root.action || root.steps || (Array.isArray(root) ? root : []);
      steps = Array.isArray(potentialActions) ? potentialActions : [potentialActions];
      
      // Fallback nếu object chỉ chứa 1 action đơn lẻ
      if (steps.length === 0 && root.selector) steps = [root as WebhookStep];
    }

    const finalSteps = steps.filter((s: WebhookStep) => s && s.selector);
    
    setPhaseData({ 
      guide, 
      requireConfirm: confirm, 
      currentPhase: phase 
    });
    
    setParsedSteps(finalSteps);
    return finalSteps;
  };

  /**
   * BƯỚC 1: KHỞI TẠO PHIÊN (Sau khi người dùng điền Survey)
   * - Gửi thông tin khảo sơ tới webhook
   * - Server xử lý và trả về danh sách action cần thực thi
   */
  const initSession = async () => {
    setStatus('INIT_SENDING'); // Hiển thị trạng thái "đang gửi"
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: "SURVEY_INITIALIZATION", 
          id_session: sessionId, 
          userAnswers: answers 
        })
      });
      
      const data = await res.json();
      const steps = processResponse(data);

      if (steps.length > 0) {
        setStatus('READY_EXECUTE');
      } else {
        setStatus('ACTION_DONE');
      }
    } catch (e: any) { 
      setErrorMessage("Không kết nối được với máy chủ Trợ lý.");
      setStatus('ERROR'); 
    }
  };

  /**
   * CƠ CHẾ FEEDBACK LOOP: QUÉT TRANG & PHẢN HỒI THEO PHASE
   * Sau khi hoàn thành 1 phase, quét lại trang để:
   * 1. Kiểm tra kết quả đã lưu chưa
   * 2. Nhận lệnh phase tiếp theo từ server
   */
  const requestNextSteps = async () => {
    setStatus('SCANNING'); // Hiển thị "Đang quét dữ liệu trang web..."
    try {
      // BƯỚC 1: Quét dữ liệu trang web hiện tại thông qua content script
      const scanResult: any = await new Promise(resolve => {
        scanResolver.current = resolve;
        window.parent.postMessage({ type: "DVC_REQUEST_SCAN" }, "*");
      });

      // BƯỚC 2: Gửi kết quả quét + phase đã hoàn thành về webhook
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: "PAGE_SCAN", 
          completed_phase: phaseData.currentPhase, // Báo cáo phase vừa xong
          ...scanResult, 
          id_session: sessionId, 
          userAnswers: answers 
        })
      });
      
      const data = await res.json();
      
      // Xử lý gói tin nhận về (Smart Dispatcher)
      const steps = processResponse(data);

      if (steps.length > 0) {
        setStatus('READY_EXECUTE');
      } else {
        // Nếu n8n báo finished hoặc không còn việc
        if (data.status === 'finished') {
          setStatus('SUCCESS');
        } else {
          setErrorMessage("Trang này con chưa thấy thông tin cần điền tự động.");
          setStatus('ERROR');
        }
      }
    } catch (e: any) {
      setErrorMessage("Lỗi khi quét thông tin phản hồi.");
      setStatus('ERROR');
    }
  };

  /**
   * LUỒNG THỰC THI TỰ NHIÊN (Natural Async Dispatcher)
   * Chạy lần lượt từng action: fill input, click button, chọn option, v.v.
   */
  const runAutomation = async () => {
    setStatus('EXECUTING'); // Hiển thị "Đang điền bước X/Y"
    for (let i = 0; i < parsedSteps.length; i++) {
      setCurrentStepIndex(i); // Cập nhật bước hiện tại để hiển thị UI
      
      // Gửi lệnh action (fill, click, scroll) tới content script xử lý
      const success = await new Promise<boolean>(resolve => {
        stepResolver.current = resolve;
        window.parent.postMessage({ type: "DVC_REQUEST_STEP", step: parsedSteps[i] }, "*");
      });
      
      if (!success) break; // Nếu action thất bại thì dừng lại
      
      // Chờ giữa các action để tránh thao tác quá nhanh
      // Thay đổi EXECUTION_DELAY ở đầu file để điều chỉnh tốc độ
      await new Promise<void>(r => setTimeout(r, EXECUTION_DELAY)); 
    }
    
    // Sau khi chạy xong danh sách actions của phase này
    if (phaseData.requireConfirm) {
      setStatus('WAITING_CONFIRM');
    } else {
      setStatus('ACTION_DONE');
    }
  };

  const resetSession = () => {
    api?.storage?.local.remove(['dvc_session_state']);
    setStatus('IDLE');
    setSessionId('sess_' + Math.random().toString(36).substr(2, 9));
  };

  return (
    <div className="w-full h-full flex flex-col font-sans bg-white overflow-hidden border-t-[6px] border-bca-red">
      <header className="h-14 bg-gradient-to-r from-bca-red to-red-900 flex items-center justify-between px-4 shrink-0 shadow-lg">
        <div className="flex flex-col">
          <span className="font-black text-[13px] text-white uppercase tracking-tight">TRỢ LÝ DỊCH VỤ CÔNG</span>
          <span className="text-[8px] text-bca-gold font-bold uppercase tracking-widest">Trợ giúp nộp hồ sơ</span>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowSettings(!showSettings)} className="text-white/70 p-1.5 hover:text-white transition-colors"><IconSettings className="w-4 h-4" /></button>
           <button onClick={() => window.parent.postMessage({ type: "DVC_CLOSE_WIDGET" }, "*")} className="text-white p-1 text-2xl">×</button>
        </div>
      </header>

      <main className="flex-1 bg-slate-50 flex flex-col items-center p-6 overflow-y-auto custom-scrollbar">
        {showSettings && (
          <div className="absolute inset-0 bg-white z-50 p-6 flex flex-col animate-in slide-in-from-top">
            <h3 className="font-black text-bca-red mb-4 uppercase text-xs">Cài đặt webhookUrl</h3>
            <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="w-full p-4 border-2 rounded-xl mb-4 text-[10px] font-mono outline-none focus:border-bca-red" />
            <button onClick={() => { localStorage.setItem('dvc_webhook_url', webhookUrl); setShowSettings(false); }} className="w-full py-4 bg-bca-red text-white rounded-xl font-bold uppercase text-xs shadow-lg">Lưu lại</button>
            <button onClick={resetSession} className="w-full py-3 mt-2 text-slate-400 font-bold text-[10px] uppercase">Làm mới phiên</button>
          </div>
        )}

        {/* ========== AVATAR CONTAINER ========== */}
        {/* Kích thước: w-60 h-48 = 240x192px - Thay đổi sang w-36 h-28 (nhỏ) hoặc w-72 h-60 (lớn) */}
        <div className="mb-6 shrink-0 relative">
          {/* Halo sáng phía sau ảnh */}
          <div className="absolute inset-0 bg-bca-gold/5 rounded-full blur-3xl"></div>
          {/* Ảnh avatar - phóng to 110% khi EXECUTING (đang chạy tự động) */}
          <img src={AVATAR_GIF} className={`w-60 h-48 object-contain relative z-10 transition-all duration-500 ${status === 'EXECUTING' ? 'scale-110 drop-shadow-2xl' : ''}`} />
        </div>

        {status === 'IDLE' && (
          <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom">
            <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Chào bạn!</h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed px-4">Tôi sẽ giúp điền thông tin và nộp hồ sơ trên cổng Dịch vụ công.</p>
            <button onClick={() => setStatus('SURVEY')} className="w-full py-5 bg-bca-red text-white rounded-2xl font-black text-sm uppercase shadow-2xl hover:-translate-y-1 transition-transform">BẮT ĐẦU NGAY</button>
          </div>
        )}

        {status === 'SURVEY' && (
          <div className="w-full space-y-6 animate-in fade-in pb-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mục 1: Loại giấy tờ cần xác nhận</label>
              <div className="grid grid-cols-2 gap-2">
                {['Căn cước 12 số', 'CMND 09 số'].map(type => (
                  <button key={type} onClick={() => setAnswers({...answers, documentType: type as any})} 
                    className={`py-3 rounded-xl border-2 font-black text-xs transition-all ${answers.documentType === type ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mục 2: Đối tượng cần xác nhận</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setAnswers({...answers, target: 'SELF'})} 
                  className={`py-3 rounded-xl border-2 font-black text-[11px] transition-all ${answers.target === 'SELF' ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                  Chính chủ
                </button>
                <button onClick={() => setAnswers({...answers, target: 'BEHALF'})} 
                  className={`py-3 rounded-xl border-2 font-black text-[11px] transition-all ${answers.target === 'BEHALF' ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                  Khai hộ
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mục 3: Nơi thực hiện</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => setAnswers({...answers, agencyLevel: 'PROVINCE'})} 
                  className={`py-3 px-4 rounded-xl border-2 font-black text-[11px] text-left transition-all ${answers.agencyLevel === 'PROVINCE' ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                  Công an cấp Tỉnh
                </button>
                <button onClick={() => setAnswers({...answers, agencyLevel: 'COMMUNE'})} 
                  className={`py-3 px-4 rounded-xl border-2 font-black text-[11px] text-left transition-all ${answers.agencyLevel === 'COMMUNE' ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                  Công an cấp Xã / Phường / Thị trấn
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mục 4: Hình thức nhận kết qủa</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  //{ id: 'APP', label: 'VNeID' },
                  { id: 'DIRECT', label: 'Tại cơ quan Công an' },
                  { id: 'POST', label: 'Qua Bưu điện' }
                ].map(m => (
                  <button key={m.id} onClick={() => setAnswers({...answers, deliveryMethod: m.id as any})} 
                    className={`py-3 rounded-xl border-2 font-black text-[10px] transition-all ${answers.deliveryMethod === m.id ? 'border-bca-red bg-red-50 text-bca-red' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Mục 5: Số CCCD / Định danh (tạm ẩn)
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Số CCCD / Định danh của bác</label>
                <input type="text" value={answers.idNumber} onChange={e => setAnswers({...answers, idNumber: e.target.value})} 
                className="w-full p-5 text-xl font-black bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-bca-red shadow-inner tracking-widest" placeholder="12 số..." />
              </div>
            */}
            <button onClick={initSession} className="w-full py-5 bg-bca-red text-white rounded-2xl font-black text-sm uppercase shadow-2xl mt-4 active:scale-95 transition-all">TIẾP TỤC HÀNH TRÌNH</button>
          </div>
        )}

        {(status === 'INIT_SENDING' || status === 'SCANNING') && (
          <div className="flex flex-col items-center py-12 space-y-5">
            <div className="w-12 h-12 border-4 border-bca-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              {status === 'SCANNING' ? 'Đang quét dữ liệu trang web...' : 'Đang khởi tạo phiên làm việc...'}
            </p>
          </div>
        )}

        {status === 'READY_EXECUTE' && (
          <div className="w-full flex flex-col animate-in slide-in-from-right">
            <div className="bg-white p-5 rounded-2xl shadow-md border-l-4 border-bca-gold mb-6 text-center">
              <p className="text-sm font-bold text-slate-700 italic leading-relaxed">"{phaseData.guide}"</p>
            </div>
            <div className="max-h-48 overflow-y-auto mb-6 custom-scrollbar pr-2 space-y-2.5">
              {parsedSteps.map((s, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 text-[11px] flex gap-4 items-center shadow-sm">
                  <span className="w-6 h-6 bg-red-50 text-bca-red font-black flex items-center justify-center rounded-full shrink-0 text-xs">{i+1}</span>
                  <span className="font-bold text-slate-600 leading-tight">{s.description}</span>
                </div>
              ))}
            </div>
            <button onClick={runAutomation} className="w-full py-5 bg-bca-red text-white rounded-2xl font-black text-sm uppercase shadow-2xl">Chạy đợt này ngay</button>
          </div>
        )}

        {status === 'EXECUTING' && (
          <div className="w-full pt-4">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-4 border-bca-gold relative overflow-hidden text-center">
               <div className="absolute top-0 left-0 h-1.5 bg-bca-red animate-progress-indefinite w-full"></div>
               <p className="text-[10px] font-black text-bca-red uppercase mb-4 tracking-widest">Đang điền bước {currentStepIndex + 1}/{parsedSteps.length}</p>
               <p className="text-base font-black text-slate-700 italic leading-relaxed italic">"{parsedSteps[currentStepIndex]?.description}"</p>
            </div>
          </div>
        )}

        {(status === 'ACTION_DONE' || status === 'WAITING_CONFIRM') && (
          <div className="w-full space-y-6 animate-in zoom-in">
            <div className="bg-white p-6 rounded-2xl border-l-[6px] border-bca-gold shadow-xl">
               <p className="text-base font-black text-slate-800 leading-relaxed italic text-center">
                 {status === 'WAITING_CONFIRM' ? `"${phaseData.guide}"` : "Con đã hoàn thành đợt lệnh này. Bác nhấn nút bên dưới để con kiểm tra trang web và thực hiện phase tiếp theo nhé!"}
               </p>
            </div>
            <button onClick={requestNextSteps} className="w-full py-6 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
               <IconScan className="w-5 h-5" /> 
               {status === 'WAITING_CONFIRM' ? 'Đã kiểm tra OK - Tiếp tục' : 'Kiểm tra & Phản hồi'}
            </button>
            <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-wider">Hoặc bác có thể tự tay thao tác trên trang web</p>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="text-center space-y-8 pt-6 animate-in zoom-in">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-5xl font-black shadow-inner border-4 border-white animate-bounce">✓</div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800 uppercase italic">Hoàn tất!</h3>
              <p className="text-xs text-slate-400 font-bold px-4">Bác hãy kiểm tra lại toàn bộ thông tin rồi nhấn "Gửi hồ sơ" nhé.</p>
            </div>
            <button onClick={resetSession} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Làm hồ sơ mới</button>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="text-center pt-6 animate-in shake-1">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black mb-8 border-4 border-white shadow-sm">!</div>
            <p className="text-sm text-red-500 font-black mb-10 px-4 leading-relaxed italic">{errorMessage}</p>
            <div className="flex flex-col gap-2">
              <button onClick={requestNextSteps} className="w-full py-5 bg-bca-red text-white rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all">Bác thử quét lại xem</button>
              <button onClick={() => setStatus('SURVEY')} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase">Quay lại phần khảo sát</button>
            </div>
          </div>
        )}
      </main>

      <footer className="h-7 bg-slate-100 flex items-center justify-center text-[7px] text-slate-400 font-black uppercase tracking-[0.4em] italic shadow-inner">Hệ thống trợ giúp nộp hồ sơ - Bộ Công An</footer>
    </div>
  );
};

const IconSettings = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

const IconScan = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
);

export default App;
