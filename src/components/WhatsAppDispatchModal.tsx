import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, MessageSquare, ExternalLink, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';

export interface WhatsAppDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'trip' | 'customer';
  // For Trip Mode
  tripId?: string;
  tripNumber?: string;
  driverName?: string;
  driverPhone?: string;
  // For Customer Template Mode
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  orderStatus?: 'shipped' | 'delivered';
}

export const WhatsAppDispatchModal: React.FC<WhatsAppDispatchModalProps> = ({
  isOpen,
  onClose,
  mode,
  tripId,
  tripNumber,
  driverName,
  driverPhone,
  orderNumber,
  customerName,
  customerPhone,
  orderStatus = 'shipped',
}) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [waMeLink, setWaMeLink] = useState<string | undefined>(undefined);
  const [targetPhone, setTargetPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customNote, setCustomNote] = useState('');

  // Fetch or generate preview when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSendResult(null);
      setCopied(false);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setSendResult(null);
      try {
        if (mode === 'trip') {
          setTargetPhone(driverPhone || '');
          const res = await fetch('/api/whatsapp?action=dispatch-trip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tripId,
              tripNumber,
              preview: true,
              customNotes: customNote,
            }),
          });
          const json = await res.json();
          if (json.success && json.text) {
            setMessageText(json.text);
            if (json.driverPhone) setTargetPhone(json.driverPhone);
          } else {
            setMessageText(json.error || '无法生成行程预览');
          }
        } else {
          // Customer template mode
          setTargetPhone(customerPhone || '');
          const res = await fetch('/api/whatsapp?action=customer-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderNumber,
              type: orderStatus,
            }),
          });
          const json = await res.json();
          if (json.success && json.text) {
            setMessageText(json.text);
            setWaMeLink(json.waMeLink);
            if (json.customerPhone) setTargetPhone(json.customerPhone);
          } else {
            // Fallback client-side template
            const fallback = orderStatus === 'delivered'
              ? `✅ *Pek Laju: 送达签收通知*\n\n尊敬的 ${customerName || '客户'}，您的订单 (*${orderNumber || '-'}*) 已由司机送达完成签收！感谢支持！🎉`
              : `📦 *Pek Laju: 发货通知*\n\n老板您好！您在 Pek Laju 采购的包装材料 (*${orderNumber || '-'}*) 已经装车出发，正在派送途中！🚚`;
            setMessageText(fallback);
            if (customerPhone) {
              const clean = customerPhone.replace(/[^0-9]/g, '');
              const norm = clean.startsWith('0') ? '60' + clean.substring(1) : clean;
              setWaMeLink(`https://wa.me/${norm}?text=${encodeURIComponent(fallback)}`);
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to load WhatsApp preview:', err);
        setMessageText('加载预览失败，请稍后重试。');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [isOpen, mode, tripId, tripNumber, orderNumber, orderStatus, customNote]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!messageText) return;
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Only used for internal driver dispatch
  const handleDispatchSend = async () => {
    if (!tripId && !tripNumber) return;
    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/whatsapp?action=dispatch-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          tripNumber,
          preview: false,
          customNotes: customNote,
        }),
      });
      const json = await res.json();

      if (json.success) {
        setSendResult({ success: true, message: `✅ 任务已成功推送至司机 WhatsApp (${targetPhone})！` });
      } else {
        setSendResult({ success: false, message: `❌ 发送失败: ${json.error || '未知错误'}` });
      }
    } catch (err: any) {
      setSendResult({ success: false, message: `❌ 发送失败: ${err.message}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {mode === 'trip' ? '📱 派单推送到司机 WhatsApp' : '📋 客户沟通回复模板'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'trip' 
                  ? `内部运营专线 • 车次: ${tripNumber || '-'}`
                  : `人工客服/业务员转发模板 • 单号: ${orderNumber || '-'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Target Info Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-sm">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">接收人员:</span>
              <span className="font-medium text-slate-200">
                {mode === 'trip' ? (driverName || '司机') : (customerName || '客户')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {targetPhone || '未登记手机号'}
              </span>
            </div>
          </div>

          {/* Note Banner for Customer Mode */}
          {mode === 'customer' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>安全合规提醒：</strong>官方 API 号仅供内部使用。本页面提供生成的标准通知模板，您可以一键复制并由客服/业务员通过日常微信或个人 WhatsApp 直接转发给客户。
              </div>
            </div>
          )}

          {/* Message Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>消息预览 (Bahasa Melayu & 中文):</span>
              {loading && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  生成预览中...
                </span>
              )}
            </div>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500 resize-none selection:bg-emerald-500/30"
              placeholder="生成预览中..."
              readOnly={loading}
            />
          </div>

          {/* Result Alert */}
          {sendResult && (
            <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              sendResult.success 
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              <span>{sendResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制到剪贴板！' : '复制文案'}
          </button>

          <div className="flex items-center gap-2">
            {mode === 'customer' && waMeLink && (
              <a
                href={waMeLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-900/30"
              >
                <ExternalLink className="w-4 h-4" />
                打开 WhatsApp 发送
              </a>
            )}

            {mode === 'trip' && (
              <button
                onClick={handleDispatchSend}
                disabled={sending || loading || !targetPhone}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? '正在下发...' : '一键推送到司机 WhatsApp'}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
            >
              关闭
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
