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
  RefreshCw,
  Bell,
  BellRing,
  BellOff,
} from 'lucide-react';
import type { AppAuthUser } from '../firebase';
import { DigitalTwinProfile, Task } from '../types';
import { SmartReminder } from '../utils/reminderEngine';
import { TomorrowEnergyAnalysis } from '../utils/burnoutEngine';
import { PWAInstallButton } from './PWAInstallButton';

export type AppNavTab =
  | 'dashboard'
  | 'tasks'
  | 'schedule'
  | 'focus'
  | 'notifications'
  | 'settings';

const NAV_TAB_LABELS: Record<AppNavTab, string> = {
  dashboard: 'الرئيسية',
  tasks: 'المهام',
  schedule: 'الجدول اليومي',
  focus: 'التركيز العميق',
  notifications: 'الإشعارات',
  settings: 'الإعدادات',
};

interface NavbarProps {
  currentTab: AppNavTab;
  setCurrentTab: (tab: AppNavTab) => void;
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
  authUser: AppAuthUser | null;
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

  const overdueCount = reminders.filter((r) => r.urgency === 'overdue').length;
  const totalNotificationsCount = reminders.length;
  const isNotificationsTab = currentTab === 'notifications';

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    tab: AppNavTab
  ) => {
    e.preventDefault();
    setCurrentTab(tab);
  };

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
    <>
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
                <h1 className="text-base font-bold text-slate-100 flex items-center gap-1.5 whitespace-nowrap">
                  نسخة {profile.name || 'الرقمية'}
                  <span className="hidden xl:inline-flex text-[11px] font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 px-2 py-0.5 rounded-full">
                    توأم ذكي متصل
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                مزامنة الأداء: <span className="text-emerald-400 font-semibold">{syncScore}%</span> • {currentDate}
              </p>
              <p className="text-[11px] text-cyan-400 font-semibold sm:hidden">
                {NAV_TAB_LABELS[currentTab]}
              </p>
            </div>
          </div>

          {/* Navigation Tabs + Notifications & Settings */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs lg:text-sm">
            <button
              id="nav-tab-dashboard"
              onClick={() => setCurrentTab('dashboard')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>الرئيسية</span>
            </button>

            <button
              id="nav-tab-tasks"
              onClick={() => setCurrentTab('tasks')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'tasks'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              <span>المهام</span>
            </button>

            <button
              id="nav-tab-schedule"
              onClick={() => setCurrentTab('schedule')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'schedule'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>الجدول اليومي</span>
            </button>

            <button
              id="nav-tab-focus"
              onClick={() => setCurrentTab('focus')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'focus'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Flame className="w-4 h-4 shrink-0" />
              <span>التركيز العميق</span>
            </button>

            <div className="h-5 w-px bg-slate-800 mx-0.5 shrink-0" aria-hidden="true" />

            {/* Notifications Page Navigation Link */}
            <a
              id="btn-notifications-center"
              href="#/notifications"
              onClick={(e) => handleNavClick(e, 'notifications')}
              aria-current={isNotificationsTab ? 'page' : undefined}
              title="الانتقال إلى صفحة الإشعارات والتذكيرات"
              className={`relative flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                isNotificationsTab
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : isDndActive
                  ? 'text-indigo-300 hover:bg-indigo-950/60'
                  : overdueCount > 0
                  ? 'text-rose-300 hover:bg-rose-950/50'
                  : totalNotificationsCount > 0
                  ? 'text-amber-300 hover:bg-amber-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {isDndActive ? (
                <BellOff className="w-4 h-4 shrink-0" />
              ) : overdueCount > 0 ? (
                <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
              ) : (
                <Bell className="w-4 h-4 shrink-0" />
              )}
              <span>الإشعارات</span>
              {!isDndActive && totalNotificationsCount > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-black flex items-center justify-center shadow ${
                    overdueCount > 0
                      ? 'bg-rose-500 text-white'
                      : isNotificationsTab
                      ? 'bg-slate-950/90 text-cyan-300'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {totalNotificationsCount}
                </span>
              )}
            </a>

            {/* Profile / Settings */}
            <button
              id="btn-twin-settings"
              type="button"
              onClick={onOpenProfile}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
              title="الإعدادات والمكونات المخصصة"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>الإعدادات</span>
            </button>
          </nav>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-2">
            
            {/* Quick AI Add */}
            <button
              id="btn-quick-add-ai"
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all whitespace-nowrap cursor-pointer"
              title="إضافة مهام ومواعيد بالذكاء الاصطناعي"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline md:hidden xl:inline">إدخال ذكي</span>
              <Plus className="w-3.5 h-3.5 sm:hidden" />
            </button>

            {/* Digital AI Assistant button */}
            <button
              id="btn-twin-chat"
              onClick={onOpenChat}
              className="flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900/90 text-cyan-200 border border-cyan-500/40 text-xs font-bold shadow-sm shadow-cyan-500/10 transition-all whitespace-nowrap cursor-pointer"
              title="فتح المساعد الرقمي AI"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline md:hidden xl:inline">المساعد الرقمي AI</span>
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

            {/* Firebase Auth & Cloud Sync Badge */}
            {authUser && (
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
                title={`مسجّل باسم ${authUser.displayName || authUser.email || ''} — اضغط لإدارة الحساب أو تسجيل الخروج`}
              >
                {cloudSyncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                ) : cloudSyncStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 text-rose-300" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span className="hidden lg:inline max-w-[100px] truncate">
                  {authUser.displayName?.split(' ')[0] || profile.name.split(' ')[0] || 'حسابي'}
                </span>
              </button>
            )}

          {/* Android / PWA Install Action */}
          <PWAInstallButton />
        </div>
      </div>
    </div>
  </header>

  {/* Restored Mobile Bottom Navigation Bar (All 6 Main Menus + Swipe Support across Views) */}
  <nav
    aria-label="التنقل الرئيسي السريع"
    className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-800/90 shadow-2xl pb-[env(safe-area-inset-bottom)]"
  >
    <div className="grid grid-cols-6 items-stretch h-16 max-w-lg mx-auto px-1">
      <button
        type="button"
        id="mobile-nav-dashboard"
        onClick={() => setCurrentTab('dashboard')}
        aria-current={currentTab === 'dashboard' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'dashboard'
            ? 'text-cyan-300 bg-cyan-500/15'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-4 h-4 shrink-0" />
        <span className="truncate">الرئيسية</span>
      </button>

      <button
        type="button"
        id="mobile-nav-tasks"
        onClick={() => setCurrentTab('tasks')}
        aria-current={currentTab === 'tasks' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'tasks'
            ? 'text-cyan-300 bg-cyan-500/15'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <CheckSquare className="w-4 h-4 shrink-0" />
        <span className="truncate">المهام</span>
      </button>

      <button
        type="button"
        id="mobile-nav-schedule"
        onClick={() => setCurrentTab('schedule')}
        aria-current={currentTab === 'schedule' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'schedule'
            ? 'text-cyan-300 bg-cyan-500/15'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Calendar className="w-4 h-4 shrink-0" />
        <span className="truncate">الجدول</span>
      </button>

      <button
        type="button"
        id="mobile-nav-focus"
        onClick={() => setCurrentTab('focus')}
        aria-current={currentTab === 'focus' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'focus'
            ? 'text-amber-300 bg-amber-500/15'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Flame className="w-4 h-4 shrink-0" />
        <span className="truncate">التركيز</span>
      </button>

      <button
        type="button"
        id="mobile-nav-notifications"
        onClick={() => setCurrentTab('notifications')}
        aria-current={currentTab === 'notifications' ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'notifications'
            ? 'text-cyan-300 bg-cyan-500/15'
            : overdueCount > 0 && !isDndActive
            ? 'text-rose-300'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className="relative">
          {isDndActive ? (
            <BellOff className="w-4 h-4 shrink-0" />
          ) : overdueCount > 0 ? (
            <BellRing className="w-4 h-4 shrink-0" />
          ) : (
            <Bell className="w-4 h-4 shrink-0" />
          )}
          {!isDndActive && totalNotificationsCount > 0 && (
            <span
              className={`absolute -top-1.5 -left-2 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                overdueCount > 0
                  ? 'bg-rose-500 text-white'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              {totalNotificationsCount > 9 ? '9+' : totalNotificationsCount}
            </span>
          )}
        </span>
        <span className="truncate">الإشعارات</span>
      </button>

      <button
        type="button"
        id="mobile-nav-settings"
        onClick={onOpenProfile}
        aria-current={currentTab === 'settings' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer rounded-xl my-1 ${
          currentTab === 'settings'
            ? 'text-cyan-300 bg-cyan-500/15'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Settings className="w-4 h-4 shrink-0" />
        <span className="truncate">الإعدادات</span>
      </button>
    </div>
  </nav>
</>
  );
};
