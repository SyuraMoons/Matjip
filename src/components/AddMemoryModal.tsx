"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import L from "leaflet";
import { useWriteContract } from "wagmi";
import type { Hash } from "viem";
import { ipfsToGatewayUrl } from "@/lib/ipfs";
import { STATUS_HOODI_CHAIN_ID, wagmiConfig } from "@/lib/wallet/config";
import { memoryRegistryContract } from "@/lib/wallet/memoryRegistry";
import { estimateCreateMemoryGas } from "@/lib/wallet/statusGas";
import { searchLocations, type LocationResult } from "@/utils/locationSearch";

export type MemoryData = {
  id: number;
  title: string;
  caption: string;
  date: string;
  location: string;
  lat: number;
  lng: number;
  photos: string[];
  emoji: string;
  metadataCid?: string;
  metadataHash?: `0x${string}`;
  txHash?: Hash;
};

type KarmaInfo = {
  karmaBalance: string;
  gaslessEligible: boolean;
};

type UploadedMemory = {
  imageCids: string[];
  metadataCid: string;
  metadataHash: `0x${string}`;
  latE6: number;
  lngE6: number;
  contractArgs: {
    metadataCid: string;
    metadataHash: `0x${string}`;
    latE6: number;
    lngE6: number;
  };
};

type AddMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: MemoryData) => void;
  currentLocation?: { lat: number; lng: number };
};

type SubmitStep = "idle" | "karma" | "uploading" | "wallet" | "confirming" | "saved";

export default function AddMemoryModal({
  isOpen,
  onClose,
  onSave,
  currentLocation,
}: AddMemoryModalProps) {
  const { address, isConnected } = useAppKitAccount({ namespace: "eip155" });
  const { chainId } = useAppKitNetwork();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<"photos" | "details" | "location">(
    "photos"
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(currentLocation || null);
  const [manualLocation, setManualLocation] = useState("");
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [submitError, setSubmitError] = useState("");
  const [uploadedMemory, setUploadedMemory] = useState<UploadedMemory | null>(
    null
  );
  const [selectedEmoji, setSelectedEmoji] = useState("📍");
  const [locationSearchResults, setLocationSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePhotoSelect = useCallback((files: FileList) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      return;
    }

    setUploadedMemory(null);
    setPhotoFiles((prev) => [...prev, ...imageFiles]);

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target?.result as string]);
        }
      };
      reader.readAsDataURL(file);
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
    setUploadedMemory(null);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };
  // Debounced location search with auto-select first result
  const handleLocationInputChange = (query: string) => {
    setUploadedMemory(null);
    setManualLocation(query);
    setShowSuggestions(true);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If input is empty, clear suggestions
    if (query.trim().length === 0) {
      setLocationSearchResults([]);
      return;
    }

    // Set new debounce timer (500ms delay)
    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);

      try {
        const results = await searchLocations(query);
        console.log("Location search results for:", query, results);
        setLocationSearchResults(results);

        // Auto-select first result (Google Maps style)
        if (results.length > 0) {
          const bestMatch = results[0];

          // Set coordinates (triggers map update)
          setLocationCoords({ lat: bestMatch.lat, lng: bestMatch.lng });

          // Auto-pin map if it exists
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([bestMatch.lat, bestMatch.lng], 8);

            if (markerRef.current) {
              mapInstanceRef.current.removeLayer(markerRef.current);
            }

            markerRef.current = L.marker([bestMatch.lat, bestMatch.lng], {
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
            }).addTo(mapInstanceRef.current);
          }
        }
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleLocationSelect = (location: LocationResult) => {
    setManualLocation(location.displayName || location.name);
    setLocationCoords({ lat: location.lat, lng: location.lng });
    setShowSuggestions(false);
    setLocationSearchResults([]);

    // Auto-pan and pin map if it exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([location.lat, location.lng], 8);
      
      // Remove old marker if exists
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
      }

      // Add new marker
      markerRef.current = L.marker([location.lat, location.lng], {
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
      }).addTo(mapInstanceRef.current);
    }
  };

  // Auto-initialize map when location step is reached
  useEffect(() => {
    if (step === "location" && mapPickerRef.current && !mapInstanceRef.current) {
      // Use setTimeout to ensure the DOM is ready
      setTimeout(() => {
        initMapPicker();
      }, 100);
    }
    // Leaflet map initialization is intentionally one-shot per modal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        const input = event.target as HTMLElement;
        if (!input.classList.contains("location-input")) {
          setShowSuggestions(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(pickerMap);

    // Add initial marker if location exists
    pickerMap.whenReady(() => {
      if (locationCoords) {
        markerRef.current = L.marker([locationCoords.lat, locationCoords.lng], {
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
    });

    // Click to select location
    const onMapClick = (e: L.LeafletMouseEvent) => {
      setUploadedMemory(null);
      setLocationCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      
      // Remove old marker if exists
      if (markerRef.current) {
        pickerMap.removeLayer(markerRef.current);
      }

      // Add new marker
      markerRef.current = L.marker([e.latlng.lat, e.latlng.lng], {
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

  const assertCanSubmit = async () => {
    if (!title || !locationCoords || photoFiles.length === 0) {
      throw new Error("Please fill in all fields and add at least one photo");
    }

    if (!isConnected || !address) {
      throw new Error("Connect your wallet before adding a memory");
    }

    if (Number(chainId) !== STATUS_HOODI_CHAIN_ID) {
      throw new Error("Switch to Status Network Hoodi before adding a memory");
    }

    setSubmitStep("karma");
    const response = await fetch(`/api/karma/${address}`);
    const karmaInfo = (await response.json()) as KarmaInfo & { error?: string };

    if (!response.ok) {
      throw new Error(karmaInfo.error || "Unable to check Karma");
    }

    if (!karmaInfo.gaslessEligible || BigInt(karmaInfo.karmaBalance) <= BigInt(0)) {
      throw new Error("You need Karma on this wallet to add a memory");
    }
  };

  const uploadMemory = async () => {
    if (uploadedMemory) {
      return uploadedMemory;
    }

    if (!locationCoords) {
      throw new Error("Choose a location before uploading");
    }

    setSubmitStep("uploading");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", caption);
    formData.append("locationName", manualLocation);
    formData.append("lat", String(locationCoords.lat));
    formData.append("lng", String(locationCoords.lng));
    photoFiles.forEach((file) => formData.append("photos", file));

    const response = await fetch("/api/memories/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as UploadedMemory & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Unable to upload memory");
    }

    setUploadedMemory(payload);
    return payload;
  };

  const handleSave = async () => {
    try {
      setSubmitError("");
      await assertCanSubmit();
      const uploaded = await uploadMemory();
      const createMemoryArgs = [
        uploaded.contractArgs.metadataCid,
        uploaded.contractArgs.metadataHash,
        uploaded.contractArgs.latE6,
        uploaded.contractArgs.lngE6,
      ] as const;

      setSubmitStep("wallet");
      const estimatedGas = await estimateCreateMemoryGas(address as `0x${string}`, createMemoryArgs);
      const txHash = await writeContractAsync({
        ...memoryRegistryContract,
        functionName: "createMemory",
        args: createMemoryArgs,
        ...estimatedGas,
      });

      setSubmitStep("confirming");
      await waitForTransactionReceipt(wagmiConfig, {
        chainId: STATUS_HOODI_CHAIN_ID,
        hash: txHash,
      });

      if (!locationCoords) {
        throw new Error("Location was cleared before the memory was saved");
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
        photos: uploaded.imageCids.map(ipfsToGatewayUrl),
        emoji: selectedEmoji || "📍",
        metadataCid: uploaded.metadataCid,
        metadataHash: uploaded.metadataHash,
        txHash,
      };

      setSubmitStep("saved");
      onSave(newMemory);
      resetForm();
      onClose();
    } catch (error) {
      setSubmitStep("idle");
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save memory"
      );
    }
  };

  const resetForm = () => {
    setStep("photos");
    setPhotos([]);
    setPhotoFiles([]);
    setTitle("");
    setCaption("");
    setLocationCoords(null);
    setManualLocation("");
    setSubmitStep("idle");
    setSubmitError("");
    setUploadedMemory(null);
    setShowSuggestions(false);
    setLocationSearchResults([]);
    
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  };

  const isSubmitting = submitStep !== "idle";
  const saveButtonLabel =
    submitStep === "karma"
      ? "Checking Karma..."
      : submitStep === "uploading"
        ? "Uploading..."
        : submitStep === "wallet"
          ? "Confirm in Wallet"
          : submitStep === "confirming"
            ? "Saving Onchain..."
            : submitStep === "saved"
              ? "Saved"
              : uploadedMemory
                ? "Retry Onchain Save"
                : "💾 Save Memory";

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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  onChange={(e) => {
                    setUploadedMemory(null);
                    setTitle(e.target.value);
                  }}
                  placeholder="e.g., Sunrise at the Temple"
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Memory Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => {
                    setUploadedMemory(null);
                    setCaption(e.target.value);
                  }}
                  placeholder="What was special about this moment?"
                  rows={4}
                  className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>
          )}

          {step === "location" && (
            <div className="space-y-6">
              <div className="flex gap-6">
                {/* Location Name with Autocomplete - Left Side */}
                <div className="relative w-1/3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location Name (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualLocation}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      onFocus={() => manualLocation && setShowSuggestions(true)}
                      placeholder="e.g., Tokyo, Japan"
                      className="w-full bg-slate-800 border border-purple-500/30 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    
                    {/* Search Results Dropdown */}
                    {showSuggestions && manualLocation.trim().length > 0 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-purple-500/30 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                      >
                        {isSearching && (
                          <div className="px-4 py-3 text-gray-400 text-sm flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            Searching...
                          </div>
                        )}
                        
                        {!isSearching && locationSearchResults.length > 0 && (
                          locationSearchResults.map((location, index) => (
                            <button
                              key={`${location.lat}-${location.lng}-${index}`}
                              onClick={() => handleLocationSelect(location)}
                              className="w-full text-left px-4 py-3 hover:bg-purple-500/20 border-b border-purple-500/10 last:border-b-0 transition"
                            >
                              <div className="text-sm text-gray-100 font-medium">{location.name}</div>
                              <div className="text-xs text-gray-400 truncate">{location.displayName}</div>
                            </button>
                          ))
                        )}
                        
                        {!isSearching && locationSearchResults.length === 0 && (
                          <div className="px-4 py-3 text-gray-400 text-sm">No locations found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Map Picker - Right Side */}
                <div className="w-2/3">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Click on the map to set exact location *
                  </label>
                  <div
                    ref={mapPickerRef}
                    className="w-full h-72 rounded-lg border border-purple-500/30 overflow-hidden bg-slate-900"
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

          {(submitError || uploadedMemory || isSubmitting) && (
            <div className="mt-6 rounded-lg border border-purple-500/30 bg-slate-950/70 p-3 text-sm text-gray-200">
              {isSubmitting && <p>{saveButtonLabel}</p>}
              {uploadedMemory && !isSubmitting && (
                <p>
                  Uploaded to Pinata. If the wallet transaction failed, you can
                  retry without uploading again.
                </p>
              )}
              {submitError && (
                <p className="mt-2 text-amber-300">{submitError}</p>
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
              (step === "location" && !locationCoords) ||
              isSubmitting
                ? "bg-slate-600 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800"
            }`}
            disabled={
              (step === "photos" && photos.length === 0) ||
              (step === "details" && !title) ||
              (step === "location" && !locationCoords) ||
              isSubmitting
            }
          >
            {step === "location" ? saveButtonLabel : "Next →"}
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
