import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Edit3,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { CustomDashboardWidget, CustomWidgetColor } from '../types';

interface CustomDashboardWidgetCardProps {
  widget: CustomDashboardWidget;
  onUpdateWidget: (updated: CustomDashboardWidget) => void;
  onEditWidget: (widget: CustomDashboardWidget) => void;
  onDeleteWidget: (widgetId: string) => void;
}

const COLOR_THEME: Record<
  CustomWidgetColor,
  { border: string; headerBg: string; badge: string; accent: string; bar: string }
> = {
  cyan: {
    border: 'border-cyan-500/35',
    headerBg: 'from-cyan-950/35 via-slate-900 to-slate-900',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    accent: 'text-cyan-300',
    bar: 'from-cyan-500 to-sky-400',
  },
  emerald: {
    border: 'border-emerald-500/35',
    headerBg: 'from-emerald-950/35 via-slate-900 to-slate-900',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    accent: 'text-emerald-300',
    bar: 'from-emerald-500 to-teal-400',
  },
  amber: {
    border: 'border-amber-500/35',
    headerBg: 'from-amber-950/35 via-slate-900 to-slate-900',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    accent: 'text-amber-300',
    bar: 'from-amber-500 to-yellow-400',
  },
  indigo: {
    border: 'border-indigo-500/35',
    headerBg: 'from-indigo-950/35 via-slate-900 to-slate-900',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    accent: 'text-indigo-300',
    bar: 'from-indigo-500 to-violet-400',
  },
  rose: {
    border: 'border-rose-500/35',
    headerBg: 'from-rose-950/35 via-slate-900 to-slate-900',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    accent: 'text-rose-300',
    bar: 'from-rose-500 to-pink-400',
  },
};

export const CustomDashboardWidgetCard: React.FC<CustomDashboardWidgetCardProps> = ({
  widget,
  onUpdateWidget,
  onEditWidget,
  onDeleteWidget,
}) => {
  const [newCheckItem, setNewCheckItem] = useState('');
  const theme = COLOR_THEME[widget.color] || COLOR_THEME.cyan;

  const toggleChecklistItem = (itemId: string) => {
    const nextItems = (widget.items || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    onUpdateWidget({ ...widget, items: nextItems });
  };

  const addQuickChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;
    const nextItems = [
      ...(widget.items || []),
      { id: `cwi-${Date.now()}`, text: newCheckItem.trim(), done: false },
    ];
    onUpdateWidget({ ...widget, items: nextItems });
    setNewCheckItem('');
  };

  const removeChecklistItem = (itemId: string) => {
    const nextItems = (widget.items || []).filter((item) => item.id !== itemId);
    onUpdateWidget({ ...widget, items: nextItems });
  };

  const updateCounter = (delta: number) => {
    const current = widget.count || 0;
    const next = Math.max(0, current + delta);
    onUpdateWidget({ ...widget, count: next });
  };

  const resetCounter = () => {
    onUpdateWidget({ ...widget, count: 0 });
  };

  const kindLabel =
    widget.kind === 'note'
      ? 'مذكرة مخصصة'
      : widget.kind === 'checklist'
      ? 'قائمة تحقق'
      : widget.kind === 'counter'
      ? 'عداد ومتتبع'
      : 'روابط سريعة';

  return (
    <div
      className={`bg-gradient-to-br ${theme.headerBg} border ${theme.border} rounded-2xl p-5 shadow-xl transition-all`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{widget.icon || '🧩'}</span>
          <div className="min-w-0">
            <h3 className={`text-base font-bold ${theme.accent} truncate`}>{widget.title}</h3>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${theme.badge}`}>
            {kindLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onEditWidget(widget)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title="تعديل المكون"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>تعديل</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteWidget(widget.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/60 text-xs font-medium transition-colors cursor-pointer"
            title="حذف المكون نهائياً"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>
      </div>

      {/* Body based on widget kind */}
      {widget.kind === 'note' && (
        <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-950/50 border border-slate-800/80 rounded-xl p-4">
          {widget.content?.trim() || 'لا يوجد نص مضاف بعد. اضغط على "تعديل" لكتابة المحتوى.'}
        </div>
      )}

      {widget.kind === 'checklist' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {(widget.items || []).length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-center">
                لا توجد عناصر في القائمة بعد — أضف أول عنصر بالأسفل.
              </p>
            ) : (
              (widget.items || []).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                    item.done
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-70'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className="flex items-center gap-2.5 text-right flex-1 min-w-0 cursor-pointer"
                  >
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs font-medium truncate ${
                        item.done ? 'line-through text-slate-500' : 'text-slate-100'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="حذف العنصر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addQuickChecklistItem} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="إضافة عنصر سريع للقائمة..."
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة</span>
            </button>
          </form>
        </div>
      )}

      {widget.kind === 'counter' && (() => {
        const count = widget.count || 0;
        const target = Math.max(1, widget.target || 10);
        const pct = Math.min(100, Math.round((count / target) * 100));

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black font-mono ${theme.accent}`}>{count}</span>
                  <span className="text-xs text-slate-400">
                    / {target} {widget.unit || 'مرة'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">نسبة الإنجاز: {pct}%</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCounter(-1)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                  title="إنقاص"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => updateCounter(1)}
                  className="w-10 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center shadow-md cursor-pointer"
                  title="زيادة"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={resetCounter}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center cursor-pointer"
                  title="تصفير العداد"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${theme.bar} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {widget.kind === 'links' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(widget.items || []).length === 0 ? (
            <p className="text-xs text-slate-400 col-span-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-center">
              لا توجد روابط مضافة بعد. اضغط &quot;تعديل&quot; لإضافة روابطك السريعة.
            </p>
          ) : (
            (widget.items || []).map((item) => (
              <a
                key={item.id}
                href={item.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-200 transition-all"
              >
                <span className="truncate">{item.text}</span>
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
};
