import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  LayoutGrid,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CustomDashboardWidget,
  CustomWidgetColor,
  CustomWidgetItem,
  CustomWidgetKind,
  DashboardLayoutEntry,
} from '../types';
import { BUILTIN_DASHBOARD_SECTIONS } from '../data/dashboardDefaults';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'create' | 'manage';
  editingWidget?: CustomDashboardWidget | null;
  layout: DashboardLayoutEntry[];
  customWidgets: CustomDashboardWidget[];
  onToggleVisibility: (id: string) => void;
  onMoveEntry: (id: string, direction: 'up' | 'down') => void;
  onResetLayout: () => void;
  onAddCustomWidget: (widget: Omit<CustomDashboardWidget, 'id' | 'createdAt'>) => void;
  onUpdateCustomWidget: (widget: CustomDashboardWidget) => void;
  onDeleteCustomWidget: (widgetId: string) => void;
}

const ICONS = ['🧩', '📝', '✅', '📊', '🔥', '📚', '🌿', '⚡', '🕌', '💼', '🎯', '💡'];
const COLORS: { id: CustomWidgetColor; label: string; dot: string }[] = [
  { id: 'cyan', label: 'سماوي', dot: 'bg-cyan-400' },
  { id: 'emerald', label: 'زمردي', dot: 'bg-emerald-400' },
  { id: 'amber', label: 'ذهبي', dot: 'bg-amber-400' },
  { id: 'indigo', label: 'نيلي', dot: 'bg-indigo-400' },
  { id: 'rose', label: 'وردي', dot: 'bg-rose-400' },
];

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'manage',
  editingWidget = null,
  layout,
  customWidgets,
  onToggleVisibility,
  onMoveEntry,
  onResetLayout,
  onAddCustomWidget,
  onUpdateCustomWidget,
  onDeleteCustomWidget,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>(initialMode);

  // Create / Edit custom widget form state
  const [kind, setKind] = useState<CustomWidgetKind>('checklist');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🧩');
  const [color, setColor] = useState<CustomWidgetColor>('cyan');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<number>(8);
  const [unit, setUnit] = useState('مرة');
  const [draftItems, setDraftItems] = useState<CustomWidgetItem[]>([
    { id: 'draft-1', text: '', done: false, url: '' },
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingWidget) {
      setActiveTab('create');
      setKind(editingWidget.kind);
      setTitle(editingWidget.title);
      setIcon(editingWidget.icon || '🧩');
      setColor(editingWidget.color || 'cyan');
      setContent(editingWidget.content || '');
      setTarget(editingWidget.target || 8);
      setUnit(editingWidget.unit || 'مرة');
      setDraftItems(
        editingWidget.items && editingWidget.items.length > 0
          ? editingWidget.items
          : [{ id: `draft-${Date.now()}`, text: '', done: false, url: '' }]
      );
    } else {
      setActiveTab(initialMode);
      setKind('checklist');
      setTitle('');
      setIcon('🧩');
      setColor('cyan');
      setContent('');
      setTarget(8);
      setUnit('مرة');
      setDraftItems([{ id: `draft-${Date.now()}`, text: '', done: false, url: '' }]);
    }
  }, [isOpen, editingWidget, initialMode]);

  if (!isOpen) return null;

  const handleAddDraftRow = () => {
    setDraftItems((prev) => [
      ...prev,
      { id: `draft-${Date.now()}-${prev.length}`, text: '', done: false, url: '' },
    ]);
  };

  const handleRemoveDraftRow = (id: string) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveCustomWidget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanedItems = draftItems
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: item.id.startsWith('draft-') ? `cwi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : item.id,
        text: item.text.trim(),
        done: Boolean(item.done),
        url: kind === 'links' ? item.url?.trim() || 'https://tarteel.ai/' : undefined,
      }));

    if (editingWidget) {
      onUpdateCustomWidget({
        ...editingWidget,
        kind,
        title: title.trim(),
        icon,
        color,
        content: kind === 'note' ? content.trim() : undefined,
        items: kind === 'checklist' || kind === 'links' ? cleanedItems : undefined,
        target: kind === 'counter' ? Math.max(1, Number(target) || 1) : undefined,
        unit: kind === 'counter' ? unit.trim() || 'مرة' : undefined,
        count: kind === 'counter' ? editingWidget.count || 0 : undefined,
      });
    } else {
      onAddCustomWidget({
        kind,
        title: title.trim(),
        icon,
        color,
        content: kind === 'note' ? content.trim() : undefined,
        items: kind === 'checklist' || kind === 'links' ? cleanedItems : undefined,
        target: kind === 'counter' ? Math.max(1, Number(target) || 1) : undefined,
        unit: kind === 'counter' ? unit.trim() || 'مرة' : undefined,
        count: kind === 'counter' ? 0 : undefined,
      });
    }

    onClose();
  };

  const getEntryMeta = (entry: DashboardLayoutEntry) => {
    if (entry.isCustom) {
      const cw = customWidgets.find((w) => w.id === entry.id);
      if (!cw) return null;
      return {
        label: cw.title,
        description:
          cw.kind === 'note'
            ? 'مكون مخصص (مذكرة)'
            : cw.kind === 'checklist'
            ? 'مكون مخصص (قائمة تحقق)'
            : cw.kind === 'counter'
            ? 'مكون مخصص (عداد يومي)'
            : 'مكون مخصص (روابط سريعة)',
        icon: cw.icon || '🧩',
        isCustom: true,
        widget: cw,
      };
    }

    const builtIn = BUILTIN_DASHBOARD_SECTIONS.find((b) => b.id === entry.id);
    if (!builtIn) return null;
    return {
      label: builtIn.label,
      description: builtIn.description,
      icon: builtIn.icon,
      isCustom: false,
      widget: undefined,
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingWidget ? 'تعديل المكون المخصص' : 'تخصيص وإدارة مكونات اللوحة'}
              </h3>
              <p className="text-xs text-slate-400">
                أضف مكونات جديدة مخصصة، عدّل الموجود، أعد ترتيب الأقسام، أو احذف/أخفِ أي مكون
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        {!editingWidget && (
          <div className="px-5 pt-4 flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'manage'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>ترتيب وإخفاء/إظهار المكونات ({layout.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'create'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مكون مخصص جديد</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'manage' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-400">
                  تحكم في ترتيب الأقسام أو إخفائها وحذف المكونات المخصصة بمرونة كاملة.
                </span>
                <button
                  type="button"
                  onClick={onResetLayout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الترتيب الافتراضي</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {layout.map((entry, idx) => {
                  const meta = getEntryMeta(entry);
                  if (!meta) return null;

                  return (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        entry.visible
                          ? 'bg-slate-950/70 border-slate-800'
                          : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-lg shrink-0 mt-0.5">{meta.icon}</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-100 truncate">
                              {meta.label}
                            </h4>
                            {meta.isCustom && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                مكون مخصص
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMoveEntry(entry.id, 'up')}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === layout.length - 1}
                          onClick={() => onMoveEntry(entry.id, 'down')}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleVisibility(entry.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                            entry.visible
                              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title={entry.visible ? 'إخفاء المكون من اللوحة' : 'إظهار المكون في اللوحة'}
                        >
                          {entry.visible ? (
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

                        {meta.isCustom && meta.widget && (
                          <button
                            type="button"
                            onClick={() => onDeleteCustomWidget(meta.widget!.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                            title="حذف المكون المخصص نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCustomWidget} className="space-y-4">
              {/* Kind selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">نوع المكون المخصص</label>
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
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        kind === opt.id
                          ? 'bg-cyan-500/15 border-cyan-400 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title + Icon + Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-300">عنوان المكون *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: متابعة شرب الماء / قائمة مراجعة المشروع / أفكار اليوم"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">الأيقونة</label>
                  <div className="flex flex-wrap gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-2">
                    {ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setIcon(ic)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer transition-all ${
                          icon === ic
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
                  <label className="text-xs font-bold text-slate-300">لون البطاقة</label>
                  <div className="flex flex-wrap gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${
                          color === c.id
                            ? 'bg-slate-800 border-white/50 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Kind-specific inputs */}
              {kind === 'note' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">محتوى المذكرة</label>
                  <textarea
                    rows={4}
                    placeholder="اكتب ملاحظاتك أو تذكيرك الشخصي أو قواعد يومك..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              )}

              {kind === 'counter' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">الهدف اليومي الرقمي</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">الوحدة</label>
                    <input
                      type="text"
                      placeholder="مثال: كوب، صفحة، دقيقة، تمرين"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {(kind === 'checklist' || kind === 'links') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">
                      {kind === 'links' ? 'الروابط السريعة' : 'عناصر القائمة'}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDraftRow}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة سطر</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {draftItems.map((item, idx) => (
                      <div key={item.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
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
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                          />
                        )}
                        {draftItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(item.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 cursor-pointer self-end sm:self-center"
                            title="حذف السطر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{editingWidget ? 'حفظ التعديلات' : 'إضافة المكون للوحة'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
