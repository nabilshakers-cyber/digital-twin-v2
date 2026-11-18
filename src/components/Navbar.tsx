import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Plus, 
  MessageSquareCode, 
  Settings, 
  LayoutDashboard, 
  CheckSquare, 
  Calendar, 
  Flame, 
  BrainCircuit,
  Volume2,
  VolumeX,
  Cloud,
  CloudOff,
  LogIn,
  RefreshCw,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { DigitalTwinProfile, Task } from '../types';
import { SmartReminder } from '../utils/reminderEngine';
import { TomorrowEnergyAnalysis } from '../utils/burnoutEngine';
import { NotificationCenter } from './NotificationCenter';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  currentTab: 'dashboard' | 'tasks' | 'schedule' | 'focus';
  setCurrentTab: (tab: 'dashboard' | 'tasks' | 'schedule' | 'focus') => void;
  profile: DigitalTwinProfile;
  onOpenQuickAdd: () => void;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onOpenBriefing: (type: 'morning' | 'evening') => void;
  syncScore: number;
  reminders: SmartReminder[];
  pushPermission: NotificationPermission | 'unsupported';
  pushEnabled: boolean;
  soundEnabled: boolean;
  onEnablePush: () => Promise<void>;
  onTogglePushEnabled: () => void;
  onToggleSound: () => void;
  onTestAlert: () => void;
  onCompleteReminder: (reminder: SmartReminder) => void;
  onSnoozeReminder: (reminderId: string, minutes: number) => void;
  onDismissReminder: (reminderId: string) => void;
  onStartFocus: (task?: Task) => void;
  isDndActive: boolean;
  autoDndEnabled: boolean;
  manualDnd: boolean;
  onToggleAutoDnd: () => void;
  onToggleManualDnd: () => void;
  authUser: User | null;
  authLoading: boolean;
  cloudSyncStatus: 'local' | 'syncing' | 'synced' | 'error';
  onSignIn: () => Promise<void>;
  onOpenCloudSettings: () => void;
  onReviewTomorrowSchedule?: () => void;
  onRebalanceWithTwin?: (analysis: TomorrowEnergyAnalysis) => void;
  onCheckTomorrowEnergy?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  profile,
  onOpenQuickAdd,
  onOpenChat,
  onOpenProfile,
  onOpenBriefing,
  syncScore,
  reminders,
  pushPermission,
  pushEnabled,
  soundEnabled,
  onEnablePush,
  onTogglePushEnabled,
  onToggleSound,
  onTestAlert,
  onCompleteReminder,
  onSnoozeReminder,
  onDismissReminder,
  onStartFocus,
  isDndActive,
  autoDndEnabled,
  manualDnd,
  onToggleAutoDnd,
  onToggleManualDnd,
  authUser,
  authLoading,
  cloudSyncStatus,
  onSignIn,
  onOpenCloudSettings,
  onReviewTomorrowSchedule,
  onRebalanceWithTwin,
  onCheckTomorrowEnergy,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('ar-SA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand & Digital Twin identity */}
          <div className="flex items-center gap-3">
            <div 
              id="twin-brand-badge"
              className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/30 cursor-pointer"
              onClick={onOpenProfile}
              title="إعدادات النسخة الرقمية"
            >
              <BrainCircuit className="w-5 h-5 text-white animate-soft-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                  نسخة {profile.name || 'الرقمية'}
                  <span className="text-[11px] font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                    توأم ذكي متصل
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                مزامنة الأداء: <span className="text-emerald-400 font-semibold">{syncScore}%</span> • {currentDate}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-sm">
            <button
              id="nav-tab-dashboard"
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                currentTab === 'dashboard'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>الرئيسية</span>
            </button>

            <button
              id="nav-tab-tasks"
              onClick={() => setCurrentTab('tasks')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                currentTab === 'tasks'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>المهام</span>
            </button>

            <button
              id="nav-tab-schedule"
              onClick={() => setCurrentTab('schedule')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                currentTab === 'schedule'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>الجدول اليومي</span>
            </button>

            <button
              id="nav-tab-focus"
              onClick={() => setCurrentTab('focus')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                currentTab === 'focus'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>التركيز العميق</span>
            </button>
          </nav>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-2">
            
            {/* Quick AI Add */}
            <button
              id="btn-quick-add-ai"
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
              title="إضافة مهام ومواعيد بالذكاء الاصطناعي"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إدخال ذكي</span>
              <Plus className="w-3.5 h-3.5 sm:hidden" />
            </button>

            {/* Digital AI Assistant button */}
            <button
              id="btn-twin-chat"
              onClick={onOpenChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900/90 text-cyan-200 border border-cyan-500/40 text-xs font-bold shadow-sm shadow-cyan-500/10 transition-all cursor-pointer"
              title="فتح المساعد الرقمي AI"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">المساعد الرقمي AI</span>
            </button>

            {/* Daily briefing trigger */}
            <button
              id="btn-daily-briefing"
              onClick={() => onOpenBriefing('morning')}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700/80 transition-all cursor-pointer"
              title="الموجز الصباحي والتحليلي"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Smart Notifications & Reminders Center */}
            <NotificationCenter
              reminders={reminders}
              pushPermission={pushPermission}
              pushEnabled={pushEnabled}
              soundEnabled={soundEnabled}
              onEnablePush={onEnablePush}
              onTogglePushEnabled={onTogglePushEnabled}
              onToggleSound={onToggleSound}
              onTestAlert={onTestAlert}
              onCompleteReminder={onCompleteReminder}
              onSnoozeReminder={onSnoozeReminder}
              onDismissReminder={onDismissReminder}
              onStartFocus={onStartFocus}
              isDndActive={isDndActive}
              autoDndEnabled={autoDndEnabled}
              manualDnd={manualDnd}
              onToggleAutoDnd={onToggleAutoDnd}
              onToggleManualDnd={onToggleManualDnd}
              onReviewTomorrowSchedule={onReviewTomorrowSchedule}
              onRebalanceWithTwin={onRebalanceWithTwin}
              onCheckTomorrowEnergy={onCheckTomorrowEnergy}
            />

            {/* Firebase Auth & Cloud Sync Badge */}
            {authUser ? (
              <button
                type="button"
                id="btn-cloud-sync-status"
                onClick={onOpenCloudSettings}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  cloudSyncStatus === 'syncing'
                    ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
                    : cloudSyncStatus === 'error'
                    ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                    : 'bg-emerald-950/60 border-emerald-600/50 text-emerald-200 hover:bg-emerald-900/60'
                }`}
                title={`متصل بحساب ${authUser.email || authUser.displayName || ''} — مزامنة سحابية`}
              >
                {cloudSyncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                ) : cloudSyncStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 text-rose-300" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span className="hidden lg:inline max-w-[100px] truncate">
                  {authUser.displayName?.split(' ')[0] || 'متزامن'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-google-signin"
                disabled={authLoading}
                onClick={onSignIn}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title="تسجيل الدخول بحساب Google لمزامنة المهام والتقويم والإعدادات"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مزامنة سحابية</span>
              </button>
            )}

            {/* Android / PWA Install Action */}
            <PWAInstallButton />

            {/* Profile / Settings */}
            <button
              id="btn-twin-settings"
              onClick={onOpenProfile}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-all cursor-pointer"
              title="الإعدادات والمكونات المخصصة"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Android-Style Fixed Bottom Navigation Bar (Mobile) */}
      <nav
        aria-label="التنقل السفلي"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0b1120]/95 backdrop-blur-lg border-t border-slate-800/90 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-around text-[11px]">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'dashboard'
                ? 'text-cyan-300 font-bold bg-cyan-500/15'
                : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>الرئيسية</span>
          </button>

          <button
            onClick={() => setCurrentTab('tasks')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'tasks'
                ? 'text-cyan-300 font-bold bg-cyan-500/15'
                : 'text-slate-400'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span>المهام</span>
          </button>

          <button
            onClick={() => setCurrentTab('schedule')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'schedule'
                ? 'text-cyan-300 font-bold bg-cyan-500/15'
                : 'text-slate-400'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span>الجدول</span>
          </button>

          <button
            onClick={() => setCurrentTab('focus')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
              currentTab === 'focus'
                ? 'text-amber-300 font-bold bg-amber-500/15'
                : 'text-slate-400'
            }`}
          >
            <Flame className="w-5 h-5" />
            <span>التركيز</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
