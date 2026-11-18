import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 max-w-md mx-auto md:mx-0 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-950/95 border border-amber-500/60 text-amber-100 shadow-2xl backdrop-blur-md"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-amber-400" />
      </div>
      <div className="min-w-0 text-xs">
        <p className="font-bold text-amber-200">وضع العمل دون إنترنت (أوفلاين)</p>
        <p className="text-[11px] text-amber-300/90 leading-relaxed">
          مهامك وجدولك وأذكارك محفوظة محلياً وتعمل بشكل كامل. ميزات الذكاء الاصطناعي تتطلب اتصالاً بالإنترنت.
        </p>
      </div>
    </div>
  );
};
