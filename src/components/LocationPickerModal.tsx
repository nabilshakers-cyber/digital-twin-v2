import React, { useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  Circle,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Briefcase,
  Check,
  Crosshair,
  Home,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SavedLocation, SavedLocationPreset } from '../types';
import {
  DEFAULT_RADIUS_OPTIONS,
  formatDistanceArabic,
  requestCurrentCoordinates,
} from '../utils/geofencing';
import {
  dispatchMapsQuotaExceeded,
  isMapsQuotaError,
  resolveGoogleMapsApiKey,
} from '../utils/mapsConfig';
import { useModalCloseListener, useModalScrollLock } from '../utils/modalCoordinator';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: SavedLocation | null;
  initialPreset?: SavedLocationPreset;
  onSave: (loc: SavedLocation) => void;
}

const DEFAULT_COORDS = { lat: 24.7136, lng: 46.6753 }; // Riyadh default center

const PRESET_OPTIONS: ReadonlyArray<{
  id: SavedLocationPreset;
  label: string;
  defaultName: string;
  icon: 'home' | 'work' | 'custom';
}> = [
  { id: 'home', label: 'المنزل', defaultName: 'المنزل', icon: 'home' },
  { id: 'work', label: 'العمل', defaultName: 'العمل', icon: 'work' },
  { id: 'custom', label: 'موقع مخصص', defaultName: '', icon: 'custom' },
];

interface PlaceSearchAutocompleteProps {
  onPlaceSelected: (details: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
    placeId?: string;
  }) => void;
  onError: (message: string) => void;
}

const PlaceSearchAutocomplete: React.FC<PlaceSearchAutocompleteProps> = ({
  onPlaceSelected,
  onError,
}) => {
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const onErrorRef = useRef(onError);
  onPlaceSelectedRef.current = onPlaceSelected;
  onErrorRef.current = onError;

  useEffect(() => {
    const container = containerRef.current;
    if (!placesLib || !container) return;

    const PlaceAutocompleteCtor = placesLib.PlaceAutocompleteElement;
    if (!PlaceAutocompleteCtor) return;

    const autocompleteEl = new PlaceAutocompleteCtor();
    autocompleteEl.className = 'w-full block rounded-xl';

    const handleSelect = async (ev: Event) => {
      const selectEvent = ev as unknown as {
        placePrediction?: {
          toPlace: () => {
            fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
            location?: { lat: () => number; lng: () => number } | null;
            displayName?: string | null;
            formattedAddress?: string | null;
            id?: string | null;
          };
        };
      };
      const prediction = selectEvent?.placePrediction;
      if (!prediction) return;

      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'id'],
        });
        const loc = place.location;
        if (!loc) return;
        onPlaceSelectedRef.current({
          lat: loc.lat(),
          lng: loc.lng(),
          name: place.displayName || undefined,
          address: place.formattedAddress || undefined,
          placeId: place.id || undefined,
        });
      } catch (err) {
        if (isMapsQuotaError(err)) {
          dispatchMapsQuotaExceeded();
        }
        onErrorRef.current('تعذر جلب إحداثيات الموقع المختار من الخريطة.');
      }
    };

    autocompleteEl.addEventListener('gmp-select', handleSelect);
    container.innerHTML = '';
    container.appendChild(autocompleteEl);

    return () => {
      autocompleteEl.removeEventListener('gmp-select', handleSelect);
      autocompleteEl.remove();
    };
  }, [placesLib]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-cyan-400" />
        <span>ابحث عن عنوان أو مكان عبر خرائط Google</span>
      </label>
      <div
        ref={containerRef}
        className="w-full min-h-[42px] rounded-xl bg-slate-950 border border-slate-700/80 px-2 py-1 text-slate-100"
      />
    </div>
  );
};

interface InteractiveGeofenceMapProps {
  coords: { lat: number; lng: number };
  radiusMeters: number;
  cameraCenter: { lat: number; lng: number };
  cameraZoom: number;
  onCameraChanged: (center: { lat: number; lng: number }, zoom: number) => void;
  onSelectCoords: (nextCoords: { lat: number; lng: number }) => void;
  onPlaceSelected: (details: {
    lat: number;
    lng: number;
    name?: string;
    address?: string;
    placeId?: string;
  }) => void;
  onSearchError: (message: string) => void;
}

const InteractiveGeofenceMap: React.FC<InteractiveGeofenceMapProps> = ({
  coords,
  radiusMeters,
  cameraCenter,
  cameraZoom,
  onCameraChanged,
  onSelectCoords,
  onPlaceSelected,
  onSearchError,
}) => {
  const apiStatus = useApiLoadingStatus();

  if (apiStatus === APILoadingStatus.AUTH_FAILURE || apiStatus === APILoadingStatus.FAILED) {
    return (
      <div className="rounded-xl bg-amber-950/35 border border-amber-700/60 p-4 text-xs text-amber-200 space-y-1.5">
        <p className="font-bold">تعذر تحميل خريطة Google التفاعلية حالياً.</p>
        <p className="text-amber-100/80">
          يمكنك متابعة تحديد موقعك عبر زر «موقعي الحالي (GPS)» أو إدخال خطوط الطول والعرض يدوياً أدناه.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlaceSearchAutocomplete onPlaceSelected={onPlaceSelected} onError={onSearchError} />

      <div className="w-full h-72 sm:h-80 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 relative">
        {apiStatus === APILoadingStatus.LOADING && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-xs text-cyan-300 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري تحميل خريطة Google...</span>
          </div>
        )}
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          center={cameraCenter}
          zoom={cameraZoom}
          onCameraChanged={(ev) => {
            onCameraChanged(ev.detail.center, ev.detail.zoom);
          }}
          onClick={(ev) => {
            if (ev.detail.latLng) {
              onSelectCoords({
                lat: ev.detail.latLng.lat,
                lng: ev.detail.latLng.lng,
              });
            }
          }}
          gestureHandling="greedy"
          className="w-full h-full"
        >
          <AdvancedMarker
            position={coords}
            draggable
            onDragEnd={(ev) => {
              if (ev.latLng) {
                onSelectCoords({
                  lat: ev.latLng.lat(),
                  lng: ev.latLng.lng(),
                });
              }
            }}
          >
            <Pin background="#06b6d4" borderColor="#cffafe" glyphColor="#0f172a" />
          </AdvancedMarker>
          <Circle
            center={coords}
            radius={radiusMeters}
            strokeColor="#06b6d4"
            strokeOpacity={0.85}
            strokeWeight={2}
            fillColor="#06b6d4"
            fillOpacity={0.18}
          />
        </GoogleMap>
      </div>
      <p className="text-[11px] text-slate-400">
        اضغط على أي نقطة في الخريطة أو اسحب الدبوس الأزرق لضبط الموقع الدقيق، وستتحدث دائرة النطاق الجغرافي ({formatDistanceArabic(radiusMeters)}) تلقائياً.
      </p>
    </div>
  );
};

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialLocation,
  initialPreset = 'work',
  onSave,
}) => {
  useModalScrollLock('location-picker', isOpen);
  useModalCloseListener('location-picker', onClose);

  const [mapsApiKey, setMapsApiKey] = useState<string>('');
  const [loadingKey, setLoadingKey] = useState<boolean>(true);

  const [preset, setPreset] = useState<SavedLocationPreset>(initialPreset);
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(DEFAULT_COORDS);
  const [cameraCenter, setCameraCenter] = useState<{ lat: number; lng: number }>(DEFAULT_COORDS);
  const [cameraZoom, setCameraZoom] = useState<number>(15);
  const [radiusMeters, setRadiusMeters] = useState<number>(200);

  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingKey(true);
    void resolveGoogleMapsApiKey()
      .then((key) => {
        if (!active) return;
        setMapsApiKey(key);
      })
      .finally(() => {
        if (active) setLoadingKey(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (initialLocation) {
      setPreset(initialLocation.preset || 'custom');
      setName(initialLocation.name);
      setAddress(initialLocation.address || '');
      setPlaceId(initialLocation.placeId);
      const next = { lat: initialLocation.lat, lng: initialLocation.lng };
      setCoords(next);
      setCameraCenter(next);
      setCameraZoom(16);
      setRadiusMeters(initialLocation.radiusMeters || 200);
    } else {
      const nextPreset = initialPreset || 'work';
      setPreset(nextPreset);
      setName(
        nextPreset === 'home' ? 'المنزل' : nextPreset === 'work' ? 'العمل' : ''
      );
      setAddress('');
      setPlaceId(undefined);
      setCoords(DEFAULT_COORDS);
      setCameraCenter(DEFAULT_COORDS);
      setCameraZoom(14);
      setRadiusMeters(200);
    }
  }, [isOpen, initialLocation, initialPreset]);

  if (!isOpen) return null;

  const handlePresetChange = (nextPreset: SavedLocationPreset) => {
    setPreset(nextPreset);
    if (!initialLocation) {
      if (nextPreset === 'home' && (!name.trim() || name === 'العمل')) {
        setName('المنزل');
      } else if (nextPreset === 'work' && (!name.trim() || name === 'المنزل')) {
        setName('العمل');
      } else if (nextPreset === 'custom' && (name === 'المنزل' || name === 'العمل')) {
        setName('');
      }
    }
  };

  const handleUseCurrentGps = async () => {
    setErrorMsg(null);
    setGpsLoading(true);
    try {
      const current = await requestCurrentCoordinates();
      const next = { lat: current.lat, lng: current.lng };
      setCoords(next);
      setCameraCenter(next);
      setCameraZoom(16);
      if (!address.trim()) {
        setAddress(`إحداثيات GPS (${current.lat.toFixed(5)}, ${current.lng.toFixed(5)})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر قراءة الموقع الجغرافي.');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('يرجى إدخال اسم الموقع (مثل: المنزل أو العمل أو النادي).');
      return;
    }
    if (
      !Number.isFinite(coords.lat) ||
      !Number.isFinite(coords.lng) ||
      coords.lat < -90 ||
      coords.lat > 90 ||
      coords.lng < -180 ||
      coords.lng > 180
    ) {
      setErrorMsg('يرجى التحقق من صحة الإحداثيات الجغرافية.');
      return;
    }

    const saved: SavedLocation = {
      id: initialLocation?.id || `loc-${Date.now()}`,
      name: cleanName,
      preset,
      address: address.trim() || undefined,
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
      radiusMeters,
      placeId,
      updatedAt: new Date().toISOString(),
    };

    onSave(saved);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initialLocation ? 'تعديل الموقع الجغرافي' : 'إضافة موقع جغرافي محفوظ'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">
                {initialLocation ? 'تعديل الموقع المحفوظ' : 'إضافة موقع جغرافي للتذكير'}
              </h3>
              <p className="text-[11px] text-slate-400">
                اختر نقطة على الخريطة وحدد نطاق التذكير عند الوصول إليه.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Preset selector + Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">نوع الموقع</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_OPTIONS.map((opt) => {
                  const active = preset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePresetChange(opt.id)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-600/90 text-white border-cyan-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {opt.icon === 'home' && <Home className="w-3.5 h-3.5" />}
                      {opt.icon === 'work' && <Briefcase className="w-3.5 h-3.5" />}
                      {opt.icon === 'custom' && <MapPin className="w-3.5 h-3.5" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                اسم الموقع *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="مثال: العمل، المنزل، مقر الجامعة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Current GPS + Radius Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <button
              type="button"
              onClick={() => void handleUseCurrentGps()}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow cursor-pointer transition-colors"
            >
              {gpsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Crosshair className="w-3.5 h-3.5" />
              )}
              <span>استخدام موقعي الحالي (GPS)</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 ml-1">نطاق التذكير:</span>
              {DEFAULT_RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRadiusMeters(opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                    radiusMeters === opt.value
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Google Map Picker */}
          {loadingKey ? (
            <div className="h-64 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>جاري تهيئة خريطة Google...</span>
            </div>
          ) : mapsApiKey ? (
            <APIProvider
              apiKey={mapsApiKey}
              libraries={['places', 'marker']}
              language="ar"
              region="SA"
            >
              <InteractiveGeofenceMap
                coords={coords}
                radiusMeters={radiusMeters}
                cameraCenter={cameraCenter}
                cameraZoom={cameraZoom}
                onCameraChanged={(center, zoom) => {
                  setCameraCenter(center);
                  setCameraZoom(zoom);
                }}
                onSelectCoords={(next) => {
                  setCoords(next);
                  setPlaceId(undefined);
                }}
                onPlaceSelected={(details) => {
                  const next = { lat: details.lat, lng: details.lng };
                  setCoords(next);
                  setCameraCenter(next);
                  setCameraZoom(16);
                  if (details.address) setAddress(details.address);
                  if (details.placeId) setPlaceId(details.placeId);
                  if (!name.trim() && details.name) {
                    setName(details.name);
                  }
                  setErrorMsg(null);
                }}
                onSearchError={(msg) => setErrorMsg(msg)}
              />
            </APIProvider>
          ) : (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-amber-300">
                مفتاح خرائط Google غير متوفر في هذه البيئة الآن — يمكنك تحديد الموقع مباشرة عبر GPS أو الإحداثيات اليدوية.
              </p>
            </div>
          )}

          {/* Address & Coordinates Display / Manual Fallback */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">
                {address
                  ? `العنوان: ${address}`
                  : `الإحداثيات المختارة: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
              </span>
              <button
                type="button"
                onClick={() => setShowManualCoords((v) => !v)}
                className="text-cyan-400 hover:underline cursor-pointer shrink-0"
              >
                {showManualCoords ? 'إخفاء الإحداثيات اليدوية' : 'تعديل الإحداثيات يدوياً'}
              </button>
            </div>

            {showManualCoords && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">خط العرض (Lat)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={coords.lat}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) {
                        setCoords((prev) => ({ ...prev, lat: val }));
                        setCameraCenter((prev) => ({ ...prev, lat: val }));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">خط الطول (Lng)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={coords.lng}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) {
                        setCoords((prev) => ({ ...prev, lng: val }));
                        setCameraCenter((prev) => ({ ...prev, lng: val }));
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">وصف العنوان (اختياري)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="وصف مختصر"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Privacy Assurance Notice */}
          <div className="px-3.5 py-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-100/90 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              يتم حفظ إحداثيات المواقع التي تختارها فقط لخدمة التذكير الجغرافي، ويمكنك إيقاف تتبع الموقع أو حذف أي موقع محفوظ في أي وقت.
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="px-3.5 py-2 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 font-semibold"
            >
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialLocation ? 'حفظ تعديلات الموقع' : 'حفظ الموقع'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
