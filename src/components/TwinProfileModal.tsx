import React, { useState, useEffect } from 'react';
import {
  X,
  BrainCircuit,
  Save,
  Download,
  Upload,
  Check,
  LayoutGrid,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Settings,
  Smartphone,
  ShieldCheck,
  Terminal,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  RefreshCw,
  BatteryCharging,
  BellRing,
  AlertTriangle,
} from 'lucide-react';
import type { AppAuthUser } from '../firebase';
import {
  CustomDashboardWidget,
  CustomWidgetColor,
  CustomWidgetItem,
  CustomWidgetKind,
  DashboardLayoutEntry,
  DigitalTwinProfile,
  Task,
  TimeBlock,
} from '../types';
import { analyzeTomorrowEnergyLoad } from '../utils/burnoutEngine';
import {
  API_BASE_OVERRIDE_KEY,
  isCapacitorNativeRuntime,
  resolveApiBase,
} from '../utils/api';

interface TwinProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: DigitalTwinProfile;
  onSaveProfile: (profile: DigitalTwinProfile) => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetData: () => void;
  customWidgets?: CustomDashboardWidget[];
  dashboardLayout?: DashboardLayoutEntry[];
  onAddCustomWidget?: (widget: Omit<CustomDashboardWidget, 'id' | 'createdAt'>) => void;
  onUpdateCustomWidget?: (widget: CustomDashboardWidget) => void;
  onDeleteCustomWidget?: (widgetId: string) => void;
  onToggleWidgetVisibility?: (id: string) => void;
  initialTab?: 'profile' | 'widgets' | 'cloud' | 'android';
  authUser?: AppAuthUser | null;
  authLoading?: boolean;
  cloudSyncStatus?: 'local' | 'syncing' | 'synced' | 'error';
  lastSyncedAt?: string | null;
  authError?: string | null;
  onSignIn?: (displayName?: string, email?: string, preferCloudPopup?: boolean) => Promise<void>;
  onSignOut?: () => Promise<void>;
  onPushLocalToCloud?: () => Promise<void>;
  tasks?: Task[];
  schedule?: TimeBlock[];
  onTriggerTomorrowEnergyCheck?: (overrideProfile?: DigitalTwinProfile) => void;
}

const ICONS = ['🧩', '📝', '✅', '📊', '🔥', '📚', '🌿', '⚡', '🕌', '💼', '🎯', '💡'];
const COLORS: { id: CustomWidgetColor; label: string; dot: string }[] = [
  { id: 'cyan', label: 'سماوي', dot: 'bg-cyan-400' },
  { id: 'emerald', label: 'زمردي', dot: 'bg-emerald-400' },
  { id: 'amber', label: 'ذهبي', dot: 'bg-amber-400' },
  { id: 'indigo', label: 'نيلي', dot: 'bg-indigo-400' },
  { id: 'rose', label: 'وردي', dot: 'bg-rose-400' },
];

export const TwinProfileModal: React.FC<TwinProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  onExportData,
  onImportData,
  onResetData,
  customWidgets = [],
  dashboardLayout = [],
  onAddCustomWidget,
  onUpdateCustomWidget,
  onDeleteCustomWidget,
  onToggleWidgetVisibility,
  initialTab = 'profile',
  authUser = null,
  authLoading = false,
  cloudSyncStatus = 'local',
  lastSyncedAt = null,
  authError = null,
  onSignIn,
  onSignOut,
  onPushLocalToCloud,
  tasks = [],
  schedule = [],
  onTriggerTomorrowEnergyCheck,
}) => {
  const [settingsTab, setSettingsTab] = useState<'profile' | 'widgets' | 'cloud' | 'android'>(
    initialTab
  );

  // Profile tab state
  const [name, setName] = useState(profile.name || '');
  const [role, setRole] = useState(profile.role || '');
  const [tone, setTone] = useState(profile.tone || 'disciplined');
  const [peakEnergy, setPeakEnergy] = useState(profile.peakEnergy || '');
  const [workStyle, setWorkStyle] = useState(profile.workStyle || '');
  const [mainGoals, setMainGoals] = useState(profile.mainGoals || '');
  const [rules, setRules] = useState(profile.rules || '');
  const [dailyWorkHoursTarget, setDailyWorkHoursTarget] = useState(
    profile.dailyWorkHoursTarget || 7
  );
  const [weeklyCompletionGoalRate, setWeeklyCompletionGoalRate] = useState(
    profile.weeklyCompletionGoalRate ?? 85
  );
  const [dailyEnergyLevel, setDailyEnergyLevel] = useState<'low' | 'medium' | 'high'>(
    profile.dailyEnergyLevel || 'medium'
  );
  const [endOfDayOverloadAlertEnabled, setEndOfDayOverloadAlertEnabled] = useState<boolean>(
    Boolean(profile.endOfDayOverloadAlertEnabled)
  );
  const [endOfDayAlertTime, setEndOfDayAlertTime] = useState<string>(
    profile.endOfDayAlertTime || '20:00'
  );
  const [showSavedToast, setShowSavedToast] = useState(false);

  // CustomDashboardWidget studio state
  const [editingWidget, setEditingWidget] = useState<CustomDashboardWidget | null>(null);
  const [kind, setKind] = useState<CustomWidgetKind>('checklist');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [widgetIcon, setWidgetIcon] = useState('🧩');
  const [widgetColor, setWidgetColor] = useState<CustomWidgetColor>('cyan');
  const [widgetContent, setWidgetContent] = useState('');
  const [widgetTarget, setWidgetTarget] = useState<number>(8);
  const [widgetUnit, setWidgetUnit] = useState('مرة');
  const [draftItems, setDraftItems] = useState<CustomWidgetItem[]>([
    { id: 'draft-1', text: '', done: false, url: '' },
  ]);
  const [widgetFeedback, setWidgetFeedback] = useState<string | null>(null);
  const [localAuthName, setLocalAuthName] = useState<string>(profile.name || '');
  const [localAuthEmail, setLocalAuthEmail] = useState<string>('');
  const [apiBaseInput, setApiBaseInput] = useState<string>(() => resolveApiBase());
  const [apiBaseSavedNotice, setApiBaseSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalAuthName(profile.name || '');
    setApiBaseInput(resolveApiBase());
    setApiBaseSavedNotice(null);
    setSettingsTab(initialTab);
    setName(profile.name || '');
    setRole(profile.role || '');
    setTone(profile.tone || 'disciplined');
    setPeakEnergy(profile.peakEnergy || '');
    setWorkStyle(profile.workStyle || '');
    setMainGoals(profile.mainGoals || '');
    setRules(profile.rules || '');
    setDailyWorkHoursTarget(profile.dailyWorkHoursTarget || 7);
    setWeeklyCompletionGoalRate(profile.weeklyCompletionGoalRate ?? 85);
    setDailyEnergyLevel(profile.dailyEnergyLevel || 'medium');
    setEndOfDayOverloadAlertEnabled(Boolean(profile.endOfDayOverloadAlertEnabled));
    setEndOfDayAlertTime(profile.endOfDayAlertTime || '20:00');
  }, [isOpen, profile, initialTab]);

  if (!isOpen) return null;

  const resetWidgetForm = () => {
    setEditingWidget(null);
    setKind('checklist');
    setWidgetTitle('');
    setWidgetIcon('🧩');
    setWidgetColor('cyan');
    setWidgetContent('');
    setWidgetTarget(8);
    setWidgetUnit('مرة');
    setDraftItems([{ id: `draft-${Date.now()}`, text: '', done: false, url: '' }]);
  };

  const loadWidgetForEdit = (widget: CustomDashboardWidget) => {
    setEditingWidget(widget);
    setKind(widget.kind);
    setWidgetTitle(widget.title);
    setWidgetIcon(widget.icon || '🧩');
    setWidgetColor(widget.color || 'cyan');
    setWidgetContent(widget.content || '');
    setWidgetTarget(widget.target || 8);
    setWidgetUnit(widget.unit || 'مرة');
    setDraftItems(
      widget.items && widget.items.length > 0
        ? widget.items
        : [{ id: `draft-${Date.now()}`, text: '', done: false, url: '' }]
    );
  };

  const showWidgetNotice = (msg: string) => {
    setWidgetFeedback(msg);
    setTimeout(() => {
      setWidgetFeedback(null);
    }, 3500);
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedGoalRate = Math.max(
      10,
      Math.min(100, Number(weeklyCompletionGoalRate) || 85)
    );
    onSaveProfile({
      ...profile,
      name,
      role,
      tone,
      peakEnergy,
      workStyle,
      mainGoals,
      rules,
      dailyWorkHoursTarget: Number(dailyWorkHoursTarget) || 7,
      weeklyCompletionGoalRate: clampedGoalRate,
      dailyEnergyLevel,
      endOfDayOverloadAlertEnabled,
      endOfDayAlertTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(endOfDayAlertTime)
        ? endOfDayAlertTime
        : '20:00',
    });
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 1000);
  };

  const handleSaveWidget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetTitle.trim()) return;

    const cleanedItems = draftItems
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: item.id.startsWith('draft-')
          ? `cwi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          : item.id,
        text: item.text.trim(),
        done: Boolean(item.done),
        url: kind === 'links' ? item.url?.trim() || 'https://tarteel.ai/' : undefined,
      }));

    if (editingWidget && onUpdateCustomWidget) {
      onUpdateCustomWidget({
        ...editingWidget,
        kind,
        title: widgetTitle.trim(),
        icon: widgetIcon,
        color: widgetColor,
        content: kind === 'note' ? widgetContent.trim() : undefined,
        items: kind === 'checklist' || kind === 'links' ? cleanedItems : undefined,
        target: kind === 'counter' ? Math.max(1, Number(widgetTarget) || 1) : undefined,
        unit: kind === 'counter' ? widgetUnit.trim() || 'مرة' : undefined,
        count: kind === 'counter' ? editingWidget.count || 0 : undefined,
      });
      showWidgetNotice(`تم تعديل المكون "${widgetTitle.trim()}" وحفظه بنجاح`);
      resetWidgetForm();
    } else if (onAddCustomWidget) {
      onAddCustomWidget({
        kind,
        title: widgetTitle.trim(),
        icon: widgetIcon,
        color: widgetColor,
        content: kind === 'note' ? widgetContent.trim() : undefined,
        items: kind === 'checklist' || kind === 'links' ? cleanedItems : undefined,
        target: kind === 'counter' ? Math.max(1, Number(widgetTarget) || 1) : undefined,
        unit: kind === 'counter' ? widgetUnit.trim() || 'مرة' : undefined,
        count: kind === 'counter' ? 0 : undefined,
      });
      showWidgetNotice(`تم إنشاء وإضافة "${widgetTitle.trim()}" إلى لوحة التحكم`);
      resetWidgetForm();
    }
  };

  const handleQuickTemplate = (
    template: Omit<CustomDashboardWidget, 'id' | 'createdAt'>
  ) => {
    if (!onAddCustomWidget) return;
    onAddCustomWidget(template);
    showWidgetNotice(`تم إضافة قالب "${template.title}" إلى لوحة التحكم`);
  };

  const isWidgetVisible = (id: string) => {
    const entry = dashboardLayout.find((e) => e.id === id);
    return entry ? entry.visible : true;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-[#0a0f1d] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="shrink-0 sticky top-0 z-20 p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
              <Settings className="w-5 h-5 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                إعدادات التطبيق وتخصيص النسخة الرقمية
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                إدارة شخصية التوأم الرقمي، النسخ الاحتياطي، المكونات المخصصة، والحساب المحلي
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الإعدادات"
            className="shrink-0 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="إغلاق الإعدادات"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 flex items-center gap-2 border-b border-slate-800 overflow-x-auto no-scrollbar bg-slate-900/70">
          <button
            type="button"
            id="settings-tab-profile"
            onClick={() => setSettingsTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              settingsTab === 'profile'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BrainCircuit className="w-4 h-4" />
            <span>ملف التوأم والإعدادات</span>
          </button>

          {onAddCustomWidget && (
            <button
              type="button"
              id="settings-tab-widgets"
              onClick={() => setSettingsTab('widgets')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                settingsTab === 'widgets'
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>المكونات المخصصة</span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-950/50 text-[10px] font-mono">
                {customWidgets.length}
              </span>
            </button>
          )}

          <button
            type="button"
            id="settings-tab-cloud"
            onClick={() => setSettingsTab('cloud')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              settingsTab === 'cloud'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>الحساب والمزامنة</span>
            {authUser && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>

          <button
            type="button"
            id="settings-tab-android"
            onClick={() => setSettingsTab('android')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              settingsTab === 'android'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>تطبيق أندرويد</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">

        {/* TAB 1: Digital Twin Profile & Data Backup */}
        {settingsTab === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">اسمك الشخصي *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: نبيل"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">مجالك / دورك المهني *</label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="مثال: مهندس برمجيات ورائد أعمال"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">أوقات ذروة الطاقة والتركيز</label>
                <input
                  type="text"
                  value={peakEnergy}
                  onChange={(e) => setPeakEnergy(e.target.value)}
                  placeholder="مثال: الصباح الباكر (8:00 ص - 12:00 م)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">نبرة الحديث وأسلوب التوأم</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as DigitalTwinProfile['tone'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="disciplined">حازم ومنضبط (يركز على عدم التسويف)</option>
                  <option value="encouraging">مشجع وإيجابي (مدرب طاقة وتحفيز)</option>
                  <option value="analytical">تحليلي وهادئ (منطقي ودقيق بالوقت)</option>
                  <option value="humorous">مرن مع لمسة دعابة وود</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">أسلوب العمل المفضل</label>
                <input
                  type="text"
                  value={workStyle}
                  onChange={(e) => setWorkStyle(e.target.value)}
                  placeholder="مثال: جلسات تركيز 45 دقيقة + راحة 10 دقائق"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  هدف معدل إنجاز المهام الأسبوعي (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={weeklyCompletionGoalRate}
                  onChange={(e) => setWeeklyCompletionGoalRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ساعات العمل اليومية المستهدفة
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={dailyWorkHoursTarget}
                  onChange={(e) => setDailyWorkHoursTarget(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">
                  الهدف الاستراتيجي الأساسي للمرحلة الحالية
                </label>
                <textarea
                  rows={2}
                  value={mainGoals}
                  onChange={(e) => setMainGoals(e.target.value)}
                  placeholder="مثال: إنهاء المنتج التقني، التجهيز للاستثمار، والمحافظة على اللياقة البدنية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">
                  قواعدك الشخصية الصارمة (قوانين العقل)
                </label>
                <textarea
                  rows={3}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder="مثال: 1. لا اجتماعات قبل الظهر. 2. إنجاز المهمة الأثقل أولاً. 3. إيقاف الإشعارات أثناء التركيز."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* Optional End-of-Day Tomorrow Energy Overload Alert */}
              {(() => {
                const draftProfile: DigitalTwinProfile = {
                  ...profile,
                  dailyWorkHoursTarget: Number(dailyWorkHoursTarget) || 7,
                  dailyEnergyLevel,
                  endOfDayOverloadAlertEnabled,
                  endOfDayAlertTime,
                };
                const tomorrowAnalysis = analyzeTomorrowEnergyLoad(tasks, schedule, draftProfile);
                return (
                  <div className="sm:col-span-2 rounded-2xl bg-slate-950/80 border border-amber-500/30 p-4 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                          <BatteryCharging className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-100">
                              مستوى الطاقة المخصص وتنبيه نهاية اليوم
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700 font-semibold">
                              ميزة اختيارية
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            تحليل المهام والمواعيد المجدولة لليوم التالي وإرسال تنبيه في نهاية اليوم عند تجاوز طاقتك المحددة.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        id="toggle-eod-overload-alert"
                        onClick={() => setEndOfDayOverloadAlertEnabled((v) => !v)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          endOfDayOverloadAlertEnabled
                            ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>{endOfDayOverloadAlertEnabled ? 'مفعّل' : 'غير مفعّل'}</span>
                      </button>
                    </div>

                    {/* Energy Level Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-300">
                        مستوى الطاقة اليومي المخصص لك:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'low', label: 'منخفضة (هادئة)', desc: 'حتى ~4.5 س / مهمة شاقة واحدة' },
                            { id: 'medium', label: 'متوسطة (متوازنة)', desc: 'وفق هدف الساعات / حتى 3 شاقة' },
                            { id: 'high', label: 'عالية (مكثفة)', desc: '8+ س / حتى 5 مهام شاقة' },
                          ] as const
                        ).map((tier) => (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => setDailyEnergyLevel(tier.id)}
                            className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                              dailyEnergyLevel === tier.id
                                ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-[11px] font-bold">{tier.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{tier.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* End-of-Day Alert Time + Live Preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                      <div className="space-y-1">
                        <label
                          htmlFor="input-eod-alert-time"
                          className="text-[11px] font-semibold text-slate-300 block"
                        >
                          وقت فحص وتنبيه نهاية اليوم:
                        </label>
                        <input
                          id="input-eod-alert-time"
                          type="time"
                          value={endOfDayAlertTime}
                          onChange={(e) => setEndOfDayAlertTime(e.target.value)}
                          disabled={!endOfDayOverloadAlertEnabled}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col justify-end gap-1.5">
                        <div
                          className={`px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                            tomorrowAnalysis.isOverloaded
                              ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                              : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {tomorrowAnalysis.isOverloaded && (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className="truncate">
                              حمل الغد: {tomorrowAnalysis.totalItemsCount} عناصر ({tomorrowAnalysis.usagePercent}%)
                            </span>
                          </span>
                          {onTriggerTomorrowEnergyCheck && (
                            <button
                              type="button"
                              id="btn-preview-tomorrow-energy"
                              onClick={() => onTriggerTomorrowEnergyCheck(draftProfile)}
                              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              فحص الآن
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Backup / Export / Reset bar */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExportData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير البيانات (نسخة احتياطية)</span>
                </button>

                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>استيراد بيانات</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={onImportData}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={onResetData}
                className="text-rose-400 hover:text-rose-300 text-[11px] underline cursor-pointer"
              >
                استعادة الإعدادات الافتراضية
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {showSavedToast ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
                  <Check className="w-4 h-4" /> تم حفظ بيانات التوأم بنجاح!
                </span>
              ) : (
                <span />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ التخصيص</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: CustomDashboardWidget Studio (Create / Edit / Delete) */}
        {settingsTab === 'widgets' && (
          <div className="space-y-5">
            {widgetFeedback && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-600/60 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{widgetFeedback}</span>
              </div>
            )}

            {/* Quick Templates */}
            {!editingWidget && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>إضافة سريعة من قوالب جاهزة:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate({
                        kind: 'counter',
                        title: 'متتبع شرب الماء اليومي',
                        icon: '🌿',
                        color: 'cyan',
                        count: 0,
                        target: 8,
                        unit: 'كوب',
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-200 cursor-pointer transition-colors"
                  >
                    + 🌿 متتبع شرب الماء (8 أكواب)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate({
                        kind: 'checklist',
                        title: 'مراجعة إغلاق اليوم',
                        icon: '✅',
                        color: 'emerald',
                        items: [
                          { id: `tpl-${Date.now()}-1`, text: 'تصفية البريد والرسائل', done: false },
                          { id: `tpl-${Date.now()}-2`, text: 'تجهيز أهم 3 مهام للغد', done: false },
                        ],
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-950 border border-slate-700 hover:border-emerald-500/50 text-xs text-slate-200 cursor-pointer transition-colors"
                  >
                    + ✅ قائمة إغلاق اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickTemplate({
                        kind: 'note',
                        title: 'ملاحظة التركيز والنية',
                        icon: '💡',
                        color: 'amber',
                        content: 'تذكّر: الإنجاز المتواصل الهادئ يغلب الحماس المتقطع.',
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-950 border border-slate-700 hover:border-amber-500/50 text-xs text-slate-200 cursor-pointer transition-colors"
                  >
                    + 💡 مذكرة التركيز
                  </button>
                </div>
              </div>
            )}

            {/* Create / Edit CustomDashboardWidget Form */}
            <form
              onSubmit={handleSaveWidget}
              className="bg-slate-950/75 border border-slate-800 rounded-2xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h4 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  {editingWidget ? (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>تعديل المكون المخصص: {editingWidget.title}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>إنشاء وإضافة مكون جديد (CustomDashboardWidget)</span>
                    </>
                  )}
                </h4>
                {editingWidget && (
                  <button
                    type="button"
                    onClick={resetWidgetForm}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              {/* Kind Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'checklist', label: 'قائمة تحقق', desc: 'عناصر قابلة للتأشير' },
                    { id: 'note', label: 'مذكرة وتذكير', desc: 'نص أو خطة مركزة' },
                    { id: 'counter', label: 'عداد يومي', desc: 'هدف رقمي مع +/-' },
                    { id: 'links', label: 'روابط سريعة', desc: 'اختصارات لمواقعك' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKind(opt.id)}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      kind === opt.id
                        ? 'bg-cyan-500/15 border-cyan-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Title + Icon + Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">عنوان المكون *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: متابعة العادات اليومية / أهداف الأسبوع / روابط العمل"
                    value={widgetTitle}
                    onChange={(e) => setWidgetTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">الأيقونة</label>
                  <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-xl p-2">
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setWidgetIcon(ic)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm cursor-pointer transition-all ${
                          widgetIcon === ic
                            ? 'bg-cyan-600/30 border border-cyan-400 scale-105'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">اللون</label>
                  <div className="flex flex-wrap gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setWidgetColor(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer ${
                          widgetColor === c.id
                            ? 'bg-slate-800 border-white/50 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Kind-specific inputs */}
              {kind === 'note' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">محتوى المذكرة</label>
                  <textarea
                    rows={3}
                    placeholder="اكتب ملاحظاتك أو تذكيرك الشخصي..."
                    value={widgetContent}
                    onChange={(e) => setWidgetContent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              )}

              {kind === 'counter' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">الهدف اليومي</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={widgetTarget}
                      onChange={(e) => setWidgetTarget(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">الوحدة</label>
                    <input
                      type="text"
                      placeholder="مثال: كوب، صفحة، دقيقة"
                      value={widgetUnit}
                      onChange={(e) => setWidgetUnit(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {(kind === 'checklist' || kind === 'links') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      {kind === 'links' ? 'الروابط السريعة' : 'عناصر القائمة'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftItems((prev) => [
                          ...prev,
                          { id: `draft-${Date.now()}-${prev.length}`, text: '', done: false, url: '' },
                        ])
                      }
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      + إضافة سطر
                    </button>
                  </div>
                  <div className="space-y-2">
                    {draftItems.map((item, idx) => (
                      <div key={item.id} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder={kind === 'links' ? `اسم الرابط ${idx + 1}` : `عنصر ${idx + 1}`}
                          value={item.text}
                          onChange={(e) =>
                            setDraftItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id ? { ...row, text: e.target.value } : row
                              )
                            )
                          }
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                        {kind === 'links' && (
                          <input
                            type="url"
                            placeholder="https://..."
                            value={item.url || ''}
                            onChange={(e) =>
                              setDraftItems((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, url: e.target.value } : row
                                )
                              )
                            }
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                          />
                        )}
                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems((prev) => prev.filter((row) => row.id !== item.id))
                            }
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer self-end sm:self-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingWidget ? 'حفظ التعديلات' : 'إنشاء وإضافة للوحة'}</span>
                </button>
              </div>
            </form>

            {/* Existing CustomDashboardWidgets List (Edit / Show-Hide / Delete) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300">
                  المكونات المخصصة المضافة ({customWidgets.length})
                </h4>
              </div>

              {customWidgets.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                  لم تقم بإضافة أي مكونات مخصصة بعد. استخدم النموذج أعلاه أو القوالب السريعة لإنشاء أول مكون.
                </div>
              ) : (
                <div className="space-y-2">
                  {customWidgets.map((cw) => {
                    const visible = isWidgetVisible(cw.id);
                    return (
                      <div
                        key={cw.id}
                        className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">{cw.icon || '🧩'}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="text-sm font-bold text-slate-100 truncate">
                                {cw.title}
                              </h5>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                {cw.kind === 'checklist'
                                  ? 'قائمة تحقق'
                                  : cw.kind === 'note'
                                  ? 'مذكرة'
                                  : cw.kind === 'counter'
                                  ? 'عداد'
                                  : 'روابط'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {visible ? 'ظاهر في لوحة التحكم' : 'مخفي حالياً'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => loadWidgetForEdit(cw)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          {onToggleWidgetVisibility && (
                            <button
                              type="button"
                              onClick={() => onToggleWidgetVisibility(cw.id)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                                visible
                                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              {visible ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>ظاهر</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>مخفي</span>
                                </>
                              )}
                            </button>
                          )}

                          {onDeleteCustomWidget && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteCustomWidget(cw.id);
                                if (editingWidget?.id === cw.id) resetWidgetForm();
                                showWidgetNotice(`تم حذف "${cw.title}" بنجاح`);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Account & Sync (In-App Local Auth + Optional Desktop Cloud Sync) */}
        {settingsTab === 'cloud' && (
          <div className="space-y-4 text-xs">
            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200">
                {authError}
              </div>
            )}

            {authUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {authUser.photoURL ? (
                      <img
                        src={authUser.photoURL}
                        alt={authUser.displayName || 'صورة الحساب'}
                        className="w-12 h-12 rounded-2xl border border-emerald-500/40 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 flex items-center justify-center text-emerald-300 font-bold text-lg">
                        {(authUser.displayName || authUser.email || 'U')[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-100">
                          {authUser.displayName || 'مستخدم مسجل'}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {authUser.mode === 'firebase' ? 'متصل بـ Firestore' : 'حساب محلي داخل التطبيق'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{authUser.email}</p>
                    </div>
                  </div>

                  {onSignOut && (
                    <button
                      type="button"
                      id="btn-modal-signout"
                      onClick={onSignOut}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-200 hover:text-rose-200 border border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>تسجيل الخروج والعودة للرئيسية</span>
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-2">
                      {authUser.mode === 'local' ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      ) : cloudSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : cloudSyncStatus === 'error' ? (
                        <CloudOff className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Cloud className="w-4 h-4 text-emerald-400" />
                      )}
                      <span>
                        {authUser.mode === 'local'
                          ? 'الحالة: مسجّل محلياً بأمان داخل التطبيق (بدون روابط خارجية)'
                          : cloudSyncStatus === 'syncing'
                          ? 'حالة المزامنة: جارٍ المزامنة...'
                          : cloudSyncStatus === 'error'
                          ? 'حالة المزامنة: يوجد خطأ في المزامنة'
                          : 'حالة المزامنة: محدّثة ومتزامنة مع السحابة'}
                      </span>
                    </span>
                    {lastSyncedAt && authUser.mode === 'firebase' && (
                      <span className="text-[11px] text-slate-400">آخر تحديث: {lastSyncedAt}</span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    جميع مهامك، جدول الأعمال والتقويم الهجري والميلادي، إعدادات التوأم الرقمي، الأهداف، ورد القرآن والأذكار، المكونات المخصصة، وقوائم تطبيقات الهاتف محفوظة محلياً فوراً على جهازك.
                  </p>

                  {onPushLocalToCloud && authUser.mode === 'firebase' && (
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={cloudSyncStatus === 'syncing'}
                        onClick={onPushLocalToCloud}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إعادة رفع ومزامنة النسخة الحالية للسحابة</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-cyan-500/30 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">
                    تسجيل الدخول وإدارة الحساب داخل التطبيق
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                    سجّل دخولك مباشرة داخل التطبيق دون فتح أي روابط خارجية أو صفحات متصفح منفصلة، مع حفظ جلستك وبياناتك محلياً بأمان.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                  <input
                    type="text"
                    value={localAuthName}
                    onChange={(e) => setLocalAuthName(e.target.value)}
                    placeholder="الاسم المعروض في التطبيق"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="email"
                    value={localAuthEmail}
                    onChange={(e) => setLocalAuthEmail(e.target.value)}
                    placeholder="البريد الإلكتروني (اختياري)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {onSignIn && (
                    <button
                      type="button"
                      id="btn-local-inapp-signin"
                      disabled={authLoading}
                      onClick={() =>
                        onSignIn(
                          localAuthName.trim() || profile.name || 'مستخدم التوأم الرقمي',
                          localAuthEmail.trim() || undefined,
                          false
                        )
                      }
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{authLoading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول داخل التطبيق'}</span>
                    </button>
                  )}

                  {onSignIn && !isCapacitorNativeRuntime() && (
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={() => onSignIn(undefined, undefined, true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Cloud className="w-4 h-4 text-cyan-300" />
                      <span>مزامنة Google السحابية (للويب)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Android Conversion & APK Setup */}
        {settingsTab === 'android' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Cloud className="w-4 h-4" />
                <span>عنوان خادم المساعد الذكي لتطبيق Android</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                يستخدم تطبيق Capacitor عنوان الخادم التالي للاتصال بنظام Gemini API. يمكنك تعديله إذا قمت باستضافة الخادم على نطاق آخر:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://your-server-url.run.app"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (apiBaseInput.trim()) {
                        localStorage.setItem(
                          API_BASE_OVERRIDE_KEY,
                          apiBaseInput.trim().replace(/\/$/, '')
                        );
                      } else {
                        localStorage.removeItem(API_BASE_OVERRIDE_KEY);
                      }
                      setApiBaseInput(resolveApiBase());
                      setApiBaseSavedNotice('تم حفظ عنوان الخادم بنجاح');
                    } catch {
                      setApiBaseSavedNotice('تعذر حفظ العنوان');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer shrink-0"
                >
                  حفظ الرابط
                </button>
              </div>
              {apiBaseSavedNotice && (
                <p className="text-[11px] text-emerald-300 font-semibold">{apiBaseSavedNotice}</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-700/40 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>التطبيق جاهز للعمل كتطبيق أندرويد مستقل (Android WebAPK + Offline)</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                تم تحويل التطبيق لدعم العمل كتطبيق أندرويد بوضع ملء الشاشة (Standalone)، مع شريط تنقل سفلي مخصص للهواتف، وتخزين مؤقت للعمل دون إنترنت (Offline)، وملفات الأيقونات المخصصة.
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pt-1">
                <li>افتح رابط التطبيق في متصفح <strong>Chrome</strong> على هاتفك الأندرويد.</li>
                <li>اضغط على زر <strong>«تثبيت على أندرويد»</strong> في الشريط العلوي أو من قائمة Chrome <strong>⋮</strong> اختر <strong>«تثبيت التطبيق»</strong>.</li>
                <li>سيُثبَّت التطبيق مباشرة على شاشة هاتفك كأيقونة أصلية مع دعم الإشعارات والميكروفون.</li>
              </ol>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Terminal className="w-4 h-4" />
                <span>مشروع Android Studio / Capacitor APK المدمج</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                تم إعداد <code className="text-cyan-300 font-mono">capacitor.config.ts</code> ومجلد مشروع أندرويد الأصلي <code className="text-cyan-300 font-mono">android/</code> بمعرف الحزمة <code className="text-emerald-300 font-mono">com.digitaltwin.taskmanager</code>:
              </p>
              <pre
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto text-left"
                dir="ltr"
              >
{`npm run android:sync
npx cap open android`}
              </pre>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
