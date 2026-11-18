import React, { useState } from 'react';
import {
  Edit3,
  ExternalLink,
  FolderPlus,
  Globe,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CustomWidgetColor, PhoneAppList, PhoneAppShortcut } from '../types';
import { POPULAR_PHONE_APP_PRESETS } from '../data/dashboardDefaults';

interface PhoneAppsLauncherViewProps {
  lists: PhoneAppList[];
  onAddList: (list: Omit<PhoneAppList, 'id'>) => void;
  onUpdateList: (list: PhoneAppList) => void;
  onDeleteList: (listId: string) => void;
  onAddAppToList: (listId: string, app: Omit<PhoneAppShortcut, 'id'>) => void;
  onUpdateAppInList: (listId: string, app: PhoneAppShortcut) => void;
  onDeleteAppFromList: (listId: string, appId: string) => void;
}

const COLOR_STYLES: Record<
  CustomWidgetColor,
  { border: string; headerText: string; badge: string; cardHover: string }
> = {
  emerald: {
    border: 'border-emerald-500/30',
    headerText: 'text-emerald-300',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    cardHover: 'hover:border-emerald-400/60 hover:bg-emerald-950/25',
  },
  cyan: {
    border: 'border-cyan-500/30',
    headerText: 'text-cyan-300',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    cardHover: 'hover:border-cyan-400/60 hover:bg-cyan-950/25',
  },
  indigo: {
    border: 'border-indigo-500/30',
    headerText: 'text-indigo-300',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    cardHover: 'hover:border-indigo-400/60 hover:bg-indigo-950/25',
  },
  amber: {
    border: 'border-amber-500/30',
    headerText: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    cardHover: 'hover:border-amber-400/60 hover:bg-amber-950/25',
  },
  rose: {
    border: 'border-rose-500/30',
    headerText: 'text-rose-300',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    cardHover: 'hover:border-rose-400/60 hover:bg-rose-950/25',
  },
};

const LIST_ICONS = ['📱', '🕌', '💼', '💬', '🧭', '📚', '🏠', '⚡', '🎧', '💳', '🛠️', '🌟'];
const APP_ICONS = ['📱', '🎙️', '📖', '💚', '✈️', '✉️', '📅', '📝', '📓', '🗺️', '▶️', '📞', '🎵', '🌐', '📸', '💼'];

const isHttpLink = (url: string) => /^https?:\/\//i.test(url.trim());

export const PhoneAppsLauncherView: React.FC<PhoneAppsLauncherViewProps> = ({
  lists,
  onAddList,
  onUpdateList,
  onDeleteList,
  onAddAppToList,
  onUpdateAppInList,
  onDeleteAppFromList,
}) => {
  const [selectedListFilter, setSelectedListFilter] = useState<string>('all');

  // Add / Edit List state
  const [isListFormOpen, setIsListFormOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listTitle, setListTitle] = useState('');
  const [listIcon, setListIcon] = useState('📱');
  const [listColor, setListColor] = useState<CustomWidgetColor>('cyan');

  // Add / Edit App state
  const [isAppFormOpen, setIsAppFormOpen] = useState(false);
  const [targetListId, setTargetListId] = useState<string>(lists[0]?.id || '');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [appIcon, setAppIcon] = useState('📱');
  const [appDeepLink, setAppDeepLink] = useState('');
  const [appFallbackUrl, setAppFallbackUrl] = useState('');
  const [appNote, setAppNote] = useState('');

  const openAddListForm = () => {
    setEditingListId(null);
    setListTitle('');
    setListIcon('📱');
    setListColor('cyan');
    setIsAppFormOpen(false);
    setIsListFormOpen((v) => (editingListId ? true : !v));
  };

  const openEditListForm = (list: PhoneAppList) => {
    setEditingListId(list.id);
    setListTitle(list.title);
    setListIcon(list.icon);
    setListColor(list.color);
    setIsAppFormOpen(false);
    setIsListFormOpen(true);
  };

  const handleSaveList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listTitle.trim()) return;

    if (editingListId) {
      const existing = lists.find((l) => l.id === editingListId);
      if (existing) {
        onUpdateList({
          ...existing,
          title: listTitle.trim(),
          icon: listIcon,
          color: listColor,
        });
      }
    } else {
      onAddList({
        title: listTitle.trim(),
        icon: listIcon,
        color: listColor,
        apps: [],
      });
    }

    setIsListFormOpen(false);
    setEditingListId(null);
    setListTitle('');
  };

  const openAddAppForm = (preferredListId?: string) => {
    setEditingAppId(null);
    setTargetListId(preferredListId || (selectedListFilter !== 'all' ? selectedListFilter : lists[0]?.id || ''));
    setAppName('');
    setAppIcon('📱');
    setAppDeepLink('');
    setAppFallbackUrl('');
    setAppNote('');
    setIsListFormOpen(false);
    setIsAppFormOpen(true);
  };

  const openEditAppForm = (listId: string, app: PhoneAppShortcut) => {
    setEditingAppId(app.id);
    setTargetListId(listId);
    setAppName(app.name);
    setAppIcon(app.icon || '📱');
    setAppDeepLink(app.deepLink);
    setAppFallbackUrl(app.fallbackUrl || '');
    setAppNote(app.note || '');
    setIsListFormOpen(false);
    setIsAppFormOpen(true);
  };

  const applyPreset = (preset: (typeof POPULAR_PHONE_APP_PRESETS)[number]) => {
    setAppName(preset.name);
    setAppIcon(preset.icon);
    setAppDeepLink(preset.deepLink);
    setAppFallbackUrl(preset.fallbackUrl || '');
    setAppNote(preset.note);
  };

  const handleSaveApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !appDeepLink.trim() || !targetListId) return;

    const payload: Omit<PhoneAppShortcut, 'id'> = {
      name: appName.trim(),
      icon: appIcon,
      deepLink: appDeepLink.trim(),
      fallbackUrl: appFallbackUrl.trim() || undefined,
      note: appNote.trim() || undefined,
    };

    if (editingAppId) {
      onUpdateAppInList(targetListId, {
        id: editingAppId,
        ...payload,
      });
    } else {
      onAddAppToList(targetListId, payload);
    }

    setIsAppFormOpen(false);
    setEditingAppId(null);
    setAppName('');
    setAppDeepLink('');
    setAppFallbackUrl('');
    setAppNote('');
  };

  const visibleLists =
    selectedListFilter === 'all'
      ? lists
      : lists.filter((l) => l.id === selectedListFilter);

  const totalAppsCount = lists.reduce((acc, l) => acc + l.apps.length, 0);

  return (
    <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
              <span>قوائم تطبيقات الهاتف السريعة</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                {lists.length} قوائم • {totalAppsCount} تطبيق
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              اضغط على أي تطبيق في القوائم لفتحه مباشرة على هاتفك، مع إمكانية إضافة وتعديل القوائم والتطبيقات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            id="btn-add-phone-list"
            onClick={openAddListForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>قائمة جديدة</span>
          </button>

          {lists.length > 0 && (
            <button
              type="button"
              id="btn-add-phone-app"
              onClick={() => openAddAppForm()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة تطبيق</span>
            </button>
          )}
        </div>
      </div>

      {/* Category / List Filter Pills */}
      {lists.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedListFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              selectedListFilter === 'all'
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            كل القوائم ({lists.length})
          </button>

          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setSelectedListFilter(list.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedListFilter === list.id
                  ? 'bg-slate-800 border-cyan-400/70 text-cyan-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{list.icon}</span>
              <span>{list.title}</span>
              <span className="text-[10px] font-mono opacity-75">({list.apps.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Add / Edit List Form */}
      {isListFormOpen && (
        <form
          onSubmit={handleSaveList}
          className="bg-slate-950/80 border border-cyan-700/50 rounded-2xl p-4 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-cyan-300">
              {editingListId ? 'تعديل القائمة' : 'إنشاء قائمة تطبيقات جديدة'}
            </span>
            <button
              type="button"
              onClick={() => setIsListFormOpen(false)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-300">اسم القائمة *</label>
              <input
                type="text"
                required
                placeholder="مثال: قائمة تطبيقات البنوك والخدمات / قائمة الدراسة"
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">أيقونة القائمة</label>
              <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-xl p-2">
                {LIST_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setListIcon(ic)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm cursor-pointer ${
                      listIcon === ic ? 'bg-cyan-600/30 border border-cyan-400' : 'hover:bg-slate-800'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">لون القائمة</label>
              <select
                value={listColor}
                onChange={(e) => setListColor(e.target.value as CustomWidgetColor)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="cyan">سماوي</option>
                <option value="emerald">زمردي</option>
                <option value="indigo">نيلي</option>
                <option value="amber">ذهبي</option>
                <option value="rose">وردي</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsListFormOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
            >
              {editingListId ? 'حفظ تعديل القائمة' : 'إنشاء القائمة'}
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit App Form */}
      {isAppFormOpen && (
        <form
          onSubmit={handleSaveApp}
          className="bg-slate-950/85 border border-indigo-700/50 rounded-2xl p-4 space-y-3 animate-fadeIn"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-indigo-300">
              {editingAppId ? 'تعديل اختصار التطبيق' : 'إضافة تطبيق من هاتفك إلى القائمة'}
            </span>
            <button
              type="button"
              onClick={() => setIsAppFormOpen(false)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Popular App Presets */}
          {!editingAppId && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>اختر تطبيقاً شائعاً للتعبئة التلقائية أو أدخل رابط التطبيق يدوياً:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_PHONE_APP_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!editingAppId && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">إضافة إلى قائمة *</label>
                <select
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.icon} {l.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`space-y-1 ${editingAppId ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-semibold text-slate-300">اسم التطبيق *</label>
              <input
                type="text"
                required
                placeholder="مثال: واتساب / ترتيل / نوشن"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                رابط فتح التطبيق المباشر (Deep Link / URI) *
              </label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="whatsapp://  أو  https://tarteel.ai/  أو  tel:"
                value={appDeepLink}
                onChange={(e) => setAppDeepLink(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                رابط المتصفح البديل (اختياري)
              </label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://..."
                value={appFallbackUrl}
                onChange={(e) => setAppFallbackUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">وصف مختصر (اختياري)</label>
              <input
                type="text"
                placeholder="مثال: مراجعة الورد اليومي"
                value={appNote}
                onChange={(e) => setAppNote(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">الأيقونة</label>
              <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                {APP_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setAppIcon(ic)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm cursor-pointer ${
                      appIcon === ic ? 'bg-cyan-600/30 border border-cyan-400' : 'hover:bg-slate-800'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAppFormOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
            >
              {editingAppId ? 'حفظ التعديلات' : 'إضافة التطبيق للقائمة'}
            </button>
          </div>
        </form>
      )}

      {/* Lists Grid */}
      {visibleLists.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-950/50 border border-slate-800 text-center space-y-2">
          <Smartphone className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-200">لا توجد قوائم تطبيقات حالياً</p>
          <p className="text-xs text-slate-400">
            اضغط &quot;قائمة جديدة&quot; لإنشاء قائمة تحتوي على تطبيقات هاتفك للدخول السريع إليها.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleLists.map((list) => {
            const style = COLOR_STYLES[list.color] || COLOR_STYLES.cyan;

            return (
              <div
                key={list.id}
                className={`bg-slate-950/60 border ${style.border} rounded-2xl p-4 space-y-3`}
              >
                {/* List Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{list.icon}</span>
                    <h4 className={`text-sm font-bold ${style.headerText} truncate`}>
                      {list.title}
                    </h4>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${style.badge}`}
                    >
                      {list.apps.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAddAppForm(list.id)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 cursor-pointer"
                      title="إضافة تطبيق لهذه القائمة"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditListForm(list)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                      title="تعديل القائمة"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedListFilter === list.id) setSelectedListFilter('all');
                        onDeleteList(list.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer"
                      title="حذف القائمة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Apps inside List */}
                {list.apps.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-500">
                    القائمة فارغة — اضغط زر + لإضافة أول تطبيق من هاتفك
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {list.apps.map((app) => {
                      const http = isHttpLink(app.deepLink);
                      return (
                        <div
                          key={app.id}
                          className={`group rounded-xl bg-slate-900/90 border border-slate-800 ${style.cardHover} transition-all p-2.5 flex flex-col justify-between gap-2`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={app.deepLink}
                              target={http ? '_blank' : undefined}
                              rel={http ? 'noopener noreferrer' : undefined}
                              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              title={`الدخول إلى ${app.name}`}
                            >
                              <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl shrink-0 shadow-inner">
                                {app.icon}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-100 group-hover:text-white truncate flex items-center gap-1">
                                  <span className="truncate">{app.name}</span>
                                  <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0 opacity-75 group-hover:opacity-100" />
                                </div>
                                {app.note && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {app.note}
                                  </p>
                                )}
                              </div>
                            </a>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditAppForm(list.id, app)}
                                className="p-1 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
                                title="تعديل التطبيق"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteAppFromList(list.id, app.id)}
                                className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                title="حذف التطبيق"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                            <a
                              href={app.deepLink}
                              target={http ? '_blank' : undefined}
                              rel={http ? 'noopener noreferrer' : undefined}
                              className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                            >
                              <Smartphone className="w-3 h-3" />
                              <span>فتح التطبيق</span>
                            </a>

                            {app.fallbackUrl && (
                              <a
                                href={app.fallbackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                                title="فتح نسخة الويب في المتصفح إذا لم يُفتح التطبيق تلقائياً"
                              >
                                <Globe className="w-3 h-3" />
                                <span>الويب</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
