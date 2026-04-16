"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import L from "leaflet";

export type MemoryData = {
  id: number;
  title: string;
  caption: string;
  date: string;
  location: string;
  lat: number;
  lng: number;
  photos: string[]; // Base64 encoded photos
  emoji: string;
};

type AddMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: MemoryData) => void;
  map: L.Map | null;
  currentLocation?: { lat: number; lng: number };
};

const EMOJI_SUGGESTIONS = [
  "📍",
  "🌅",
  "🌆",
  "🏔️",
  "🏖️",
  "🗻",
  "🎭",
  "🍜",
  "🎪",
  "🌃",
  "✈️",
  "🚀",
  "⛪",
  "🕌",
  "🏯",
  "🗼",
  "🌲",
  "🌴",
  "🐘",
  "🦁",
];

export default function AddMemoryModal({
  isOpen,
  onClose,
  onSave,
  map,
  currentLocation,
}: AddMemoryModalProps) {
  const [step, setStep] = useState<"photos" | "details" | "location">(
    "photos"
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedEmoji] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(currentLocation || null);
  const [manualLocation, setManualLocation] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const handlePhotoSelect = useCallback((files: FileList) => {
    const newPhotos: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPhotos.push(e.target.result as string);
            if (newPhotos.length === files.length) {
              setPhotos((prev) => [...prev, ...newPhotos]);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current?.classList.add("drag-active");
  }, []);

  const handleDragLeave = useCallback(() => {
    dragRef.current?.classList.remove("drag-active");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragRef.current?.classList.remove("drag-active");
      if (e.dataTransfer.files) {
        handlePhotoSelect(e.dataTransfer.files);
      }
    },
    [handlePhotoSelect]
  );

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-initialize map when location step is reached
  useEffect(() => {
    if (step === "location" && mapPickerRef.current && !mapInstanceRef.current) {
      // Use setTimeout to ensure the DOM is ready
      setTimeout(() => {
        initMapPicker();
      }, 100);
    }
  }, [step]);

  const initMapPicker = () => {
    if (!mapPickerRef.current || mapInstanceRef.current) return;

    const pickerMap = L.map(mapPickerRef.current, {
      center: locationCoords ? [locationCoords.lat, locationCoords.lng] : [20, 10],
      zoom: locationCoords ? 8 : 2,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = pickerMap;

    // Force map to recalculate size after initialization
    setTimeout(() => {
      pickerMap.invalidateSize();
    }, 100);

    // Add basic tile layer
    L.tileLayer(
      "https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
      }
    ).addTo(pickerMap);

    // Add clicked location marker
    if (locationCoords) {
      L.marker([locationCoords.lat, locationCoords.lng], {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(pickerMap);
    }

    // Click to select location
    const onMapClick = (e: L.LeafletMouseEvent) => {
      setLocationCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      // Update marker
      pickerMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          pickerMap.removeLayer(layer);
        }
      });
      L.marker([e.latlng.lat, e.latlng.lng], {
        icon: L.icon({
          iconUrl:
            "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(pickerMap);
    };

    pickerMap.on("click", onMapClick);
  };

  const handleSave = () => {
    if (!title || !locationCoords || photos.length === 0) {
      alert("Please fill in all fields and add at least one photo");
      return;
    }

    const newMemory: MemoryData = {
      id: Date.now(),
      title,
      caption,
      date: new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      location: manualLocation || "Unknown Location",
      lat: locationCoords.lat,
      lng: locationCoords.lng,
      photos,
      emoji: selectedEmoji,
    };

    onSave(newMemory);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setStep("photos");
    setPhotos([]);
    setTitle("");
    setCaption("");
    // Emoji no longer used
    setLocationCoords(null);
    setManualLocation("");
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-purple-500/30 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-purple-500/20 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
          <h2 className="text-xl font-bold text-gray-100">
            {step === "photos" && "📸 Add Photos"}
            {step === "details" && "✏️ Add Details"}
            {step === "location" && "📍 Set Location"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "photos" && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-500/40 rounded-xl p-8 cursor-pointer transition hover:border-purple-500/70 hover:bg-purple-500/5 drag-active:border-purple-500 drag-active:bg-purple-500/10 text-center"
              >
                <div className="text-4xl mb-2">📷</div>
                <p className="text-gray-200 font-medium">Drag photos here</p>
                <p className="text-gray-400 text-sm">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handlePhotoSelect(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Photo Preview Grid */}
              {photos.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-3 font-medium">
                    {photos.length} photo{photos.length !== 1 ? "s" : ""} added
                  </p>
                  <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photo}
                          alt={`Memory photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "details" && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Memory Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Sunrise at the Temple"
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Caption or Message
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="What was special about this moment?"
                  rows={4}
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>


            </div>
          )}

          {step === "location" && (
            <div className="space-y-6">
              {/* Location Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location Name (Optional)
                </label>
                <input
                  type="text"
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  placeholder="e.g., Tokyo, Japan"
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Map Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Click on the map to set exact location *
                </label>
                <div
                  ref={mapPickerRef}
                  className="w-full h-72 rounded-lg border border-purple-500/30 overflow-hidden bg-slate-900"
                  onLoad={initMapPicker}
                />
                {!mapPickerRef.current?.childElementCount && (
                  <button
                    onClick={initMapPicker}
                    className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition"
                  >
                    Load Map
                  </button>
                )}
              </div>

              {locationCoords && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-sm text-gray-300">
                    📍 Coordinates: {locationCoords.lat.toFixed(4)},{" "}
                    {locationCoords.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="bg-slate-900 border-t border-purple-500/20 px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => {
              if (step === "details") setStep("photos");
              else if (step === "location") setStep("details");
              else onClose();
            }}
            className="px-4 py-2 text-gray-300 hover:text-gray-100 transition"
          >
            ← Back
          </button>

          <div className="flex gap-2">
            {["photos", "details", "location"].map((s) => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition ${
                  s === step ? "bg-purple-500" : "bg-slate-500"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step === "photos" && photos.length > 0) setStep("details");
              else if (step === "details" && title) setStep("location");
              else if (step === "location" && locationCoords) handleSave();
            }}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              (step === "photos" && photos.length === 0) ||
              (step === "details" && !title) ||
              (step === "location" && !locationCoords)
                ? "bg-slate-600 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800"
            }`}
            disabled={
              (step === "photos" && photos.length === 0) ||
              (step === "details" && !title) ||
              (step === "location" && !locationCoords)
            }
          >
            {step === "location" ? "💾 Save Memory" : "Next →"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .drag-active {
          @apply border-purple-500 bg-purple-500/10;
        }
      `}</style>
    </div>
  );
}
