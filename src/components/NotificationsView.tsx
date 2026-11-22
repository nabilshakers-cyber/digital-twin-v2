import React, { useMemo } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  AlarmClock,
  X,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  ShieldCheck,
  Moon,
  BatteryCharging,
  Calendar,
  ArrowRight,
  Trash2,
  BookOpen,
  Repeat,
  MapPin,
  Home,
  Briefcase,
  Navigation,
  Plus,
  Edit3,
  Play,
  Loader2,
} from 'lucide-react';
import { SmartReminder } from '../utils/reminderEngine';
import { TomorrowEnergyAnalysis } from '../utils/burnoutEngine';
import { SavedLocation, SavedLocationPreset, Task } from '../types';
import { formatDistanceArabic, GeoCoordinates } from '../utils/geofencing';
import {
  cancelReminder,
  NOTIFICATION_DENIED_ALERT_MESSAGE,
  ScheduledLocalReminder,
  useScheduledReminders,
} from '../utils/localNotifications';
import { CategoryTonesCustomizer } from './CategoryTonesCustomizer';
import { LocationPickerModal } from './LocationPickerModal';

interface NotificationsViewProps {
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
  onReviewTomorrowSchedule?: () => void;
  onRebalanceWithTwin?: (analysis: TomorrowEnergyAnalysis) => void;
  onCheckTomorrowEnergy?: () => void;
  onBackToDashboard: () => void;
  savedLocations: SavedLocation[];
  tasks: Task[];
  locationTrackingEnabled: boolean;
  onToggleLocationTracking: () => void;
  onSaveLocation: (loc: SavedLocation) => void;
  onDeleteLocation: (locationId: string) => void;
  onCheckLocationNow: () => void;
  onSimulateArrival: (loc: SavedLocation) => void;
  currentGeoCoords?: GeoCoordinates | null;
  geoDistances?: Record<string, number>;
  geoError?: string | null;
  geoChecking?: boolean;
}

const CATEGORY_LABEL: Record<ScheduledLocalReminder['category'], string> = {
  quran: 'ورد القرآن',
  adhkar: 'الأذكار',
  task: 'مهمة',
};

const CATEGORY_BADGE_CLASS: Record<ScheduledLocalReminder['category'], string> = {
  quran: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
  adhkar: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
  task: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({
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
  onReviewTomorrowSchedule,
  onRebalanceWithTwin,
  onCheckTomorrowEnergy,
  onBackToDashboard,
  savedLocations,
  tasks,
  locationTrackingEnabled,
  onToggleLocationTracking,
  onSaveLocation,
  onDeleteLocation,
  onCheckLocationNow,
  onSimulateArrival,
  currentGeoCoords,
  geoDistances = {},
  geoError,
  geoChecking = false,
}) => {
  const scheduledMap = useScheduledReminders();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<SavedLocation | null>(null);
  const [pickerPreset, setPickerPreset] = React.useState<SavedLocationPreset>('work');

  const scheduledList = useMemo(() => {
    const items = Object.values(scheduledMap) as ScheduledLocalReminder[];
    return items
      .filter((item) => item.repeatDaily || new Date(item.scheduledAt).getTime() >= Date.now() - 60_000)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [scheduledMap]);

  const overdueCount = reminders.filter((r) => r.urgency === 'overdue').length;
  const dueSoonCount = reminders.filter((r) => r.urgency === 'due_soon').length;
  const totalCount = reminders.length;

  return (
    <div id="notifications-page" className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
                isDndActive
                  ? 'bg-indigo-950/80 border-indigo-700/70 text-indigo-300'
                  : overdueCount > 0
                  ? 'bg-rose-950/80 border-rose-700/70 text-rose-300'
                  : 'bg-cyan-950/80 border-cyan-700/70 text-cyan-300'
              }`}
            >
              {isDndActive ? (
                <BellOff className="w-5 h-5" />
              ) : overdueCount > 0 ? (
                <BellRing className="w-5 h-5 animate-bounce" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-100">
                  مركز الإشعارات والتنبيهات
                </h2>
                {totalCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                    {totalCount} تنبيه نشط
                  </span>
                )}
                {overdueCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-700/60 font-bold">
                    {overdueCount} متأخر
                  </span>
                )}
                {dueSoonCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold">
                    {dueSoonCount} قريب
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                متابعة التذكيرات الذكية، حالة عدم الإزعاج، والمنبهات المجدولة على جهازك.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Push & Sound & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="flex items-center gap-2 min-w-0 text-xs">
              {pushPermission === 'granted' && pushEnabled ? (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-300 truncate">
                {pushPermission === 'unsupported'
                  ? 'التنبيهات المرئية والمحلية نشطة'
                  : pushPermission === 'denied'
                  ? NOTIFICATION_DENIED_ALERT_MESSAGE
                  : pushPermission === 'granted'
                  ? pushEnabled
                    ? 'إشعارات الدفع (Push) مفعلة'
                    : 'إشعارات الدفع متوقفة مؤقتاً'
                  : 'إشعارات المتصفح غير مفعلة بعد'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {pushPermission === 'default' && (
                <button
                  type="button"
                  onClick={onEnablePush}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  تفعيل الدفع
                </button>
              )}

              {pushPermission === 'granted' && (
                <button
                  type="button"
                  onClick={onTogglePushEnabled}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    pushEnabled
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {pushEnabled ? 'مفعل' : 'متوقف'}
                </button>
              )}

              <button
                type="button"
                onClick={onToggleSound}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title={soundEnabled ? 'إيقاف صوت التنبيه' : 'تفعيل صوت التنبيه'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{soundEnabled ? 'الصوت مفعل' : 'صامت'}</span>
              </button>

              {onCheckTomorrowEnergy && (
                <button
                  type="button"
                  onClick={onCheckTomorrowEnergy}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-700/70 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <BatteryCharging className="w-3.5 h-3.5" />
                  <span>طاقة الغد</span>
                </button>
              )}

              <button
                type="button"
                onClick={onTestAlert}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تجربة تنبيه</span>
              </button>
            </div>
          </div>

          {/* Do Not Disturb Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs">
              <Moon className={`w-4 h-4 shrink-0 ${isDndActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="text-slate-300">وضع عدم الإزعاج أثناء التركيز</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={onToggleAutoDnd}
                className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  autoDndEnabled
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoDndEnabled ? 'تلقائي: مفعل' : 'تلقائي: معطل'}
              </button>

              <button
                type="button"
                onClick={onToggleManualDnd}
                className={`px-2.5 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                  manualDnd
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {manualDnd ? 'عدم إزعاج: نشط' : 'كتم مؤقت'}
              </button>
            </div>
          </div>
        </div>

        {pushPermission === 'denied' && (
          <div
            role="alert"
            className="mt-3 px-3.5 py-2.5 rounded-xl bg-amber-950/50 border border-amber-700/60 text-xs text-amber-200 flex items-center gap-2 font-medium"
          >
            <BellOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{NOTIFICATION_DENIED_ALERT_MESSAGE}</span>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Smart Reminders Feed */}
        <section className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-cyan-400" />
              <span>التنبيهات والتذكيرات الذكية</span>
            </h3>
            <span className="text-xs text-slate-400">{totalCount} عنصر</span>
          </div>

          {isDndActive ? (
            <div className="py-10 text-center space-y-3 bg-indigo-950/20 rounded-2xl border border-indigo-800/40 p-6">
              <ShieldCheck className="w-10 h-10 text-indigo-400 mx-auto" />
              <p className="text-sm font-bold text-indigo-200">
                وضع عدم الإزعاج مفعل حالياً
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                تم إخفاء جميع التنبيهات وإشعارات المتصفح لحماية تركيزك العميق. ستعود التذكيرات فور إيقاف الكتم أو انتهاء الجلسة.
              </p>
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-12 text-center space-y-2.5 bg-slate-950/40 rounded-2xl border border-slate-800/60">
              <Sparkles className="w-9 h-9 text-emerald-400 mx-auto opacity-85" />
              <p className="text-sm font-bold text-slate-200">
                كل شيء تحت السيطرة تماماً!
              </p>
              <p className="text-xs text-slate-400">
                لا توجد مهام متأخرة أو مواعيد عاجلة مقتربة حالياً.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((rem) => {
                const isOverdue = rem.urgency === 'overdue';
                const isGentle = rem.urgency === 'gentle' || rem.sourceType === 'adhkar';
                const isEnergyWarning =
                  rem.urgency === 'energy_warning' || rem.sourceType === 'energy_overload';
                const isLocationArrival =
                  rem.urgency === 'location_arrival' || rem.sourceType === 'location';
                return (
                  <div
                    key={rem.id}
                    className={`rounded-2xl border p-4 space-y-3 transition-all ${
                      isLocationArrival
                        ? 'bg-cyan-950/30 border-cyan-500/60'
                        : isEnergyWarning
                        ? 'bg-amber-950/30 border-amber-500/60'
                        : isGentle
                        ? 'bg-emerald-950/25 border-emerald-700/50'
                        : isOverdue
                        ? 'bg-rose-950/25 border-rose-800/60'
                        : 'bg-amber-950/20 border-amber-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isLocationArrival ? (
                          <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        ) : isEnergyWarning ? (
                          <BatteryCharging className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : isGentle ? (
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : isOverdue ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-100 leading-snug">
                            {rem.title}
                          </h4>
                          {isEnergyWarning && rem.energyAnalysis && (
                            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                              {rem.energyAnalysis.overloadReasons[0] ||
                                rem.energyAnalysis.recommendation}
                            </p>
                          )}
                          <span
                            className={`inline-block mt-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${
                              isLocationArrival
                                ? 'bg-cyan-950 text-cyan-200 border border-cyan-700/70'
                                : isEnergyWarning
                                ? 'bg-amber-950 text-amber-300 border border-amber-700/70'
                                : isGentle
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/70'
                                : isOverdue
                                ? 'bg-rose-950 text-rose-300 border border-rose-800/70'
                                : 'bg-amber-950 text-amber-300 border border-amber-800/70'
                            }`}
                          >
                            {rem.timeLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDismissReminder(rem.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 shrink-0 cursor-pointer"
                        title="إغلاق التذكير"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-800/60 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEnergyWarning ? (
                          <>
                            {onReviewTomorrowSchedule && (
                              <button
                                type="button"
                                onClick={onReviewTomorrowSchedule}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-semibold transition-colors cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>جدول الغد</span>
                              </button>
                            )}
                            {onRebalanceWithTwin && rem.energyAnalysis && (
                              <button
                                type="button"
                                onClick={() => onRebalanceWithTwin(rem.energyAnalysis!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/70 font-medium cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>موازنة AI</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onCompleteReminder(rem)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/70 font-medium cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isGentle ? 'تمت الأذكار' : 'إكمال'}</span>
                            </button>

                            {rem.task && (
                              <button
                                type="button"
                                onClick={() => onStartFocus(rem.task)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 font-semibold transition-colors cursor-pointer"
                              >
                                <Flame className="w-3.5 h-3.5" />
                                <span>تركيز الآن</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSnoozeReminder(rem.id, 15)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                        title="تأجيل التذكير 15 دقيقة"
                      >
                        <AlarmClock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>تأجيل 15د</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Local Scheduled Alarms Sidebar */}
        <aside className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <AlarmClock className="w-4 h-4 text-amber-400" />
              <span>التذكيرات المجدولة</span>
            </h3>
            <span className="text-xs text-slate-400">{scheduledList.length}</span>
          </div>

          {scheduledList.length === 0 ? (
            <div className="py-10 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-slate-300">لا توجد تذكيرات محلية مجدولة</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                يمكنك جدولة منبه بجانب أي عنصر في ورد القرآن أو الأذكار أو المهام ليصلك إشعار حتى في الخلفية.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {scheduledList.map((item) => (
                <div
                  key={item.itemKey}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${CATEGORY_BADGE_CLASS[item.category]}`}
                        >
                          {CATEGORY_LABEL[item.category]}
                        </span>
                        {item.repeatDaily && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center gap-1">
                            <Repeat className="w-2.5 h-2.5" />
                            يومياً
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 truncate">{item.title}</h4>
                      {item.body && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{item.body}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void cancelReminder(item.itemKey)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
                      title="إلغاء التذكير"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                    <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                      <Clock className="w-3 h-3" />
                      {item.timeHHMM}
                    </span>
                    <span>{item.repeatDaily ? 'تكرار يومي' : item.dateISO}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Location-Based Geofencing Reminders Section */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                التذكيرات الجغرافية (المواقع المحفوظة)
              </h3>
              <p className="text-xs text-slate-400">
                استقبل تنبيهاً تلقائياً عند وصولك لموقع محدد (مثل العمل أو المنزل) بالمهام المرتبطة به.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingLocation(null);
                setPickerPreset('work');
                setPickerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة موقع جديد على الخريطة</span>
            </button>
          </div>
        </div>

        {/* Opt-in Tracking Consent & Live GPS Controls */}
        <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Navigation
                className={`w-4 h-4 shrink-0 ${
                  locationTrackingEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">
                  تفعيل مراقبة الموقع للتنبيه عند الوصول
                </p>
                <p className="text-[11px] text-slate-400">
                  {locationTrackingEnabled
                    ? currentGeoCoords
                      ? `التتبع نشط • آخر قراءة: ${currentGeoCoords.lat.toFixed(4)}, ${currentGeoCoords.lng.toFixed(4)}`
                      : 'التتبع نشط — في انتظار قراءة إحداثيات GPS من الجهاز'
                    : 'متوقف حالياً (يتطلب موافقتك الصريحة للبدء ويمكنك إيقافه في أي وقت)'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleLocationTracking}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  locationTrackingEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {locationTrackingEnabled ? 'المراقبة مفعلة (إيقاف)' : 'تفعيل المراقبة'}
              </button>

              <button
                type="button"
                onClick={onCheckLocationNow}
                disabled={geoChecking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                {geoChecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>فحص الموقع الآن</span>
              </button>
            </div>
          </div>

          {geoError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-lg bg-amber-950/50 border border-amber-700/60 text-[11px] text-amber-200"
            >
              {geoError}
            </div>
          )}

          <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/70">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              خصوصيتك محفوظة: لا يتم فحص الموقع في الخلفية إلا بعد تفعيلك للمفتاح أعلاه، وتُستخدم الإحداثيات فقط لمطابقة نطاق المهام المرتبطة بمواقعك المحفوظة.
            </span>
          </div>
        </div>

        {/* Saved Locations List */}
        {savedLocations.length === 0 ? (
          <div className="py-8 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4">
            <MapPin className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs font-bold text-slate-300">لا توجد مواقع محفوظة بعد</p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              أضف مواقعك المتكررة مثل المنزل أو العمل ثم اربط مهامك بها ليتم تذكيرك فور وصولك.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditingLocation(null);
                  setPickerPreset('home');
                  setPickerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>+ إضافة المنزل</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingLocation(null);
                  setPickerPreset('work');
                  setPickerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>+ إضافة العمل</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedLocations.map((loc) => {
              const linkedActiveCount = tasks.filter(
                (t) =>
                  t.status !== 'completed' &&
                  t.locationReminder?.enabled &&
                  t.locationReminder.locationId === loc.id
              ).length;
              const liveDistance = geoDistances[loc.id];
              const isInside =
                typeof liveDistance === 'number' && liveDistance <= loc.radiusMeters;

              return (
                <div
                  key={loc.id}
                  className={`p-4 rounded-2xl border space-y-3 transition-all ${
                    isInside
                      ? 'bg-cyan-950/25 border-cyan-500/60'
                      : 'bg-slate-950/70 border-slate-800/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-300 shrink-0">
                        {loc.preset === 'home' ? (
                          <Home className="w-4 h-4" />
                        ) : loc.preset === 'work' ? (
                          <Briefcase className="w-4 h-4" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-100 truncate">{loc.name}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                            نطاق {formatDistanceArabic(loc.radiusMeters)}
                          </span>
                          {isInside && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              أنت داخل النطاق الآن
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocation(loc);
                          setPickerPreset(loc.preset || 'custom');
                          setPickerOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 cursor-pointer"
                        title="تعديل الموقع على الخريطة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLocation(loc.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer"
                        title="حذف الموقع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
                    <div className="flex flex-wrap items-center gap-2 text-slate-400">
                      <span>
                        المهام المرتبطة:{' '}
                        <strong className="text-slate-200">{linkedActiveCount}</strong>
                      </span>
                      {typeof liveDistance === 'number' && (
                        <span>• البعد الحالي: {formatDistanceArabic(liveDistance)}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSimulateArrival(loc)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-700/60 font-semibold transition-colors cursor-pointer"
                      title="اختبار ظهور تنبيه الوصول لهذا الموقع فوراً"
                    >
                      <Play className="w-3 h-3" />
                      <span>محاكاة الوصول (تجربة)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Category Alert Tones Customization Section */}
      <CategoryTonesCustomizer
        soundEnabled={soundEnabled}
        onEnableSound={soundEnabled ? undefined : onToggleSound}
      />

      <LocationPickerModal
        isOpen={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setEditingLocation(null);
        }}
        initialLocation={editingLocation}
        initialPreset={pickerPreset}
        onSave={onSaveLocation}
      />
    </div>
  );
};
