"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import L from "leaflet";
import { useWriteContract } from "wagmi";
import { formatEther, type Hash } from "viem";
import { ipfsToGatewayUrl } from "@/lib/ipfs";
import { STATUS_HOODI_CHAIN_ID, wagmiConfig } from "@/lib/wallet/config";
import { memoryRegistryContract } from "@/lib/wallet/memoryRegistry";
import { estimateCreateMemoryGas } from "@/lib/wallet/statusGas";
import { searchLocations, type LocationResult } from "@/utils/locationSearch";

export type MemoryData = {
  id: number;
  createdAt: number;
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
  source: "official" | "matjip";
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

type UploadResponsePayload = (UploadedMemory & { error?: string }) | { error: string };

type AddMemoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: MemoryData) => void;
  onMemoryConfirmed?: () => void;
  currentLocation?: { lat: number; lng: number };
};

type SubmitStep =
  | "idle"
  | "karma"
  | "uploading"
  | "estimating"
  | "wallet"
  | "confirming"
  | "saved";

type CreateMemoryArgs = readonly [
  metadataCid: string,
  metadataHash: `0x${string}`,
  latE6: number,
  lngE6: number,
];

type PreparedMemorySave = {
  uploaded: UploadedMemory;
  createMemoryArgs: CreateMemoryArgs;
  estimatedGas: Awaited<ReturnType<typeof estimateCreateMemoryGas>>;
  feeCapLabel: string;
  isGaslessEstimate: boolean;
};

const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
const CLIENT_UPLOAD_BODY_LIMIT_BYTES = 4 * 1024 * 1024;
const IMAGE_COMPRESSION_PASSES = [
  { maxSize: 1600, quality: 0.82 },
  { maxSize: 1280, quality: 0.72 },
  { maxSize: 1024, quality: 0.62 },
] as const;

type ImageCompressionPass = (typeof IMAGE_COMPRESSION_PASSES)[number];

function formatFeeCap(wei: bigint) {
  if (wei === BigInt(0)) {
    return "0 ETH";
  }

  return `${Number(formatEther(wei)).toLocaleString(undefined, {
    maximumSignificantDigits: 4,
  })} ETH`;
}

function safeUploadFileName(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  return `${stem.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "memory"}.jpg`;
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read ${file.name || "image"}`));
    };
    image.src = objectUrl;
  });
}

async function compressImageForUpload(
  file: File,
  compression: ImageCompressionPass
) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name || "File"} is not an image`);
  }

  const image = await loadImageElement(file);
  const scale = Math.min(
    1,
    compression.maxSize / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image compression is unavailable in this browser");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", compression.quality);
  });

  if (!blob) {
    throw new Error(`Unable to compress ${file.name || "image"}`);
  }

  return new File([blob], safeUploadFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function preparePhotosForUpload(files: File[]) {
  for (const compression of IMAGE_COMPRESSION_PASSES) {
    const compressed = await Promise.all(
      files.map((file) => compressImageForUpload(file, compression))
    );
    const totalBytes = compressed.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes <= CLIENT_UPLOAD_BODY_LIMIT_BYTES) {
      return compressed;
    }
  }

  throw new Error(
    `Photos are too large for Vercel's ${(
      VERCEL_FUNCTION_BODY_LIMIT_BYTES / 1024 / 1024
    ).toFixed(1)}MB upload limit. Remove some photos or choose smaller images.`
  );
}

async function readUploadResponse(
  response: Response
): Promise<UploadResponsePayload> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as UploadedMemory & { error?: string };
  }

  const text = await response.text();
  return {
    error:
      response.status === 413
        ? "Photos are too large for Vercel. Remove some photos or choose smaller images."
        : text || `Upload failed with HTTP ${response.status}`,
  };
}

export default function AddMemoryModal({
  isOpen,
  onClose,
  onSave,
  onMemoryConfirmed,
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
  const [submitNotice, setSubmitNotice] = useState("");
  const [uploadedMemory, setUploadedMemory] = useState<UploadedMemory | null>(
    null
  );
  const [preparedSave, setPreparedSave] = useState<PreparedMemorySave | null>(
    null
  );
  const [selectedEmoji, setSelectedEmoji] = useState("📍");
  const [locationSearchResults, setLocationSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

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

  const handleCloseModal = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    markerRef.current = null;
    setIsMapLoaded(false);
    setShowSuggestions(false);
    setLocationSearchResults([]);

    onClose();
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

  // Clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      markerRef.current = null;
      setIsMapLoaded(false);
      setShowSuggestions(false);
      setLocationSearchResults([]);
    }
  }, [isOpen]);

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

  useEffect(() => {
    if (!uploadedMemory) {
      setPreparedSave(null);
    }
  }, [uploadedMemory]);

  const initMapPicker = () => {
    if (!mapPickerRef.current || mapInstanceRef.current) return;

    const pickerMap = L.map(mapPickerRef.current, {
      center: locationCoords ? [locationCoords.lat, locationCoords.lng] : [20, 10],
      zoom: locationCoords ? 8 : 2,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = pickerMap;
    setIsMapLoaded(true);

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

    // Map is view-only — location must be selected via search
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
    try {
      const response = await fetch(`/api/karma/${address}`);
      const karmaInfo = (await response.json()) as KarmaInfo & { error?: string };

      if (!response.ok) {
        throw new Error(karmaInfo.error || "Unable to check Karma");
      }

      if (!karmaInfo.gaslessEligible || BigInt(karmaInfo.karmaBalance) <= BigInt(0)) {
        setSubmitNotice(
          karmaInfo.source === "matjip"
            ? "No Matjip Karma yet. Add connected memories to earn demo Karma."
            : "No official Status Karma found yet. The wallet can still submit with the current Hoodi paid fallback."
        );
      }
    } catch (error) {
      console.warn("Unable to read Karma before memory save", error);
      setSubmitNotice(
        "Karma is unavailable right now. The wallet can still submit if Status Network accepts the transaction."
      );
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
    const uploadFiles = await preparePhotosForUpload(photoFiles);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", caption);
    formData.append("locationName", manualLocation);
    formData.append("lat", String(locationCoords.lat));
    formData.append("lng", String(locationCoords.lng));
    uploadFiles.forEach((file) => formData.append("photos", file));

    const response = await fetch("/api/memories/upload", {
      method: "POST",
      body: formData,
    });
    const payload = await readUploadResponse(response);

    if (!response.ok || payload.error) {
      throw new Error(payload.error || "Unable to upload memory");
    }

    if (!("metadataCid" in payload)) {
      throw new Error("Upload response was missing memory metadata");
    }

    setUploadedMemory(payload);
    return payload;
  };

  const prepareSave = async () => {
    try {
      setSubmitError("");
      setSubmitNotice("");
      setPreparedSave(null);
      await assertCanSubmit();
      const uploaded = await uploadMemory();
      const createMemoryArgs = [
        uploaded.contractArgs.metadataCid,
        uploaded.contractArgs.metadataHash,
        uploaded.contractArgs.latE6,
        uploaded.contractArgs.lngE6,
      ] as const;

      setSubmitStep("estimating");
      const estimatedGas = await estimateCreateMemoryGas(
        address as `0x${string}`,
        createMemoryArgs
      );
      const isGaslessEstimate =
        estimatedGas.maxFeePerGas === BigInt(0) &&
        estimatedGas.maxPriorityFeePerGas === BigInt(0);
      const feeCapLabel = formatFeeCap(
        estimatedGas.gas * estimatedGas.maxFeePerGas
      );

      setPreparedSave({
        uploaded,
        createMemoryArgs,
        estimatedGas,
        feeCapLabel,
        isGaslessEstimate,
      });
      setSubmitStep("idle");

      if (isGaslessEstimate) {
        setSubmitNotice(
          "This memory may help complete a 5-memory connected area. Status estimates this save as gasless; continue with the current wallet confirmation for now."
        );
      } else {
        setSubmitNotice(
          "This memory may help complete a 5-memory connected area. Hoodi gasless is temporarily blocked by the RLN prover bug, so continue with the Status estimate fallback."
        );
      }
    } catch (error) {
      setSubmitStep("idle");
      setSubmitError(
        error instanceof Error ? error.message : "Unable to prepare memory save"
      );
    }
  };

  const confirmEstimatedSave = async () => {
    if (!preparedSave) {
      await prepareSave();
      return;
    }

    try {
      setSubmitError("");
      setSubmitStep("wallet");
      setSubmitNotice(
        preparedSave.isGaslessEstimate
          ? "Confirm the current wallet transaction. Status Network estimated a zero fee for this sender."
          : "Confirm the Status estimate fallback transaction in your wallet."
      );

      const txHash = await writeContractAsync({
        ...memoryRegistryContract,
        functionName: "createMemory",
        args: preparedSave.createMemoryArgs,
        ...preparedSave.estimatedGas,
      });

      setSubmitStep("confirming");
      await waitForTransactionReceipt(wagmiConfig, {
        chainId: STATUS_HOODI_CHAIN_ID,
        hash: txHash,
      });

      if (!locationCoords) {
        throw new Error("Location was cleared before the memory was saved");
      }

      const now = Date.now();

      const newMemory: MemoryData = {
        id: now,
        createdAt: now,
        title,
        caption,
        date: new Date(now).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        location: manualLocation || "Unknown Location",
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        photos: preparedSave.uploaded.imageCids.map(ipfsToGatewayUrl),
        emoji: selectedEmoji || "📍",
        metadataCid: preparedSave.uploaded.metadataCid,
        metadataHash: preparedSave.uploaded.metadataHash,
        txHash,
      };

      setSubmitStep("saved");
      setSubmitNotice(
        "Memory saved. Refreshing Matjip Karma and connected-memory progress."
      );
      onMemoryConfirmed?.();
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
    setSubmitNotice("");
    setUploadedMemory(null);
    setPreparedSave(null);
    setShowSuggestions(false);
    setLocationSearchResults([]);
    setIsMapLoaded(false);
    
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
        : submitStep === "estimating"
          ? "Estimating Fee..."
        : submitStep === "wallet"
          ? "Confirm in Wallet"
          : submitStep === "confirming"
            ? "Saving Onchain..."
            : submitStep === "saved"
              ? "Saved"
              : preparedSave
                ? "Refresh Fee Estimate"
                : uploadedMemory
                ? "Retry Onchain Save"
                : "💾 Save Memory";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseModal();
        }
      }}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-[#c9b487] bg-[#faf1d8] shadow-[0_6px_0_#b89f6a,0_12px_30px_rgba(40,25,10,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b-2 border-[#c9b487] bg-[#efe3c3] px-5 py-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="#4a2c15" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 5h14a2 2 0 0 1 2 2v20l-9-4-9 4V7a2 2 0 0 1 2-2z" fill="#e8c674" />
          </svg>
          <h2 className="flex-1 text-lg font-bold text-[#2a1a0a]" style={{ fontFamily: "'Architects Daughter', 'Marker Felt', cursive" }}>
            {step === "photos" && "Add Photos"}
            {step === "details" && "Add Details"}
            {step === "location" && "Set Location"}
          </h2>
          <button
            onClick={handleCloseModal}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c94a4a] text-white shadow-[0_2px_0_#9a3333] transition hover:bg-[#b33e3e] active:translate-y-[1px] active:shadow-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === "photos" && (
            <div className="space-y-5">
              {/* Upload Area */}
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-[#c9b487] bg-[#efe3c3] p-8 text-center transition hover:border-[#a08555] hover:bg-[#e8d9b5]"
              >
                <div className="mb-2 text-4xl">📷</div>
                <p className="font-medium text-[#2a1a0a]">Drag photos here</p>
                <p className="text-sm text-[#7a6840]">or click to browse</p>
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
                  <p className="mb-3 text-sm font-medium text-[#7a6840]">
                    {photos.length} photo{photos.length !== 1 ? "s" : ""} added
                  </p>
                  <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                    {photos.map((photo, index) => (
                      <div key={index} className="group relative rounded-xl border-2 border-[#c9b487] bg-[#efe3c3] p-1 shadow-[0_2px_0_#b89f6a]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Memory photo ${index + 1}`}
                          className="h-24 w-full rounded-lg object-cover"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#c94a4a] text-xs text-white opacity-0 shadow-[0_1px_0_#9a3333] transition group-hover:opacity-100"
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
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4a2c15]">
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
                  className="w-full rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] px-4 py-2 text-[#2a1a0a] placeholder-[#a09060] focus:border-[#a08555] focus:outline-none focus:ring-1 focus:ring-[#c9b487]"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#4a2c15]">
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
                  className="w-full resize-none rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] px-4 py-2 text-[#2a1a0a] placeholder-[#a09060] focus:border-[#a08555] focus:outline-none focus:ring-1 focus:ring-[#c9b487]"
                />
              </div>
            </div>
          )}

          {step === "location" && (
            <div className="space-y-5">
              <div className="flex gap-5">
                {/* Location Name with Autocomplete - Left Side */}
                <div className="relative w-1/3">
                  <label className="mb-2 block text-sm font-semibold text-[#4a2c15]">
                    Location Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={manualLocation}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      onFocus={() => manualLocation && setShowSuggestions(true)}
                      placeholder="Search for a place or restaurant..."
                      className="location-input w-full rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] px-4 py-2 text-[#2a1a0a] placeholder-[#a09060] focus:border-[#a08555] focus:outline-none focus:ring-1 focus:ring-[#c9b487]"
                    />

                    {/* Search Results Dropdown */}
                    {showSuggestions && manualLocation.trim().length > 0 && (
                      <div
                        ref={suggestionsRef}
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border-2 border-[#c9b487] bg-[#faf1d8] shadow-lg"
                      >
                        {isSearching && (
                          <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#7a6840]">
                            <div className="h-4 w-4 rounded-full border-2 border-[#c9b487] border-t-[#4a2c15] animate-spin" />
                            Searching...
                          </div>
                        )}

                        {!isSearching && locationSearchResults.length > 0 && (
                          locationSearchResults.map((location, index) => (
                            <button
                              key={`${location.lat}-${location.lng}-${index}`}
                              onClick={() => handleLocationSelect(location)}
                              className="w-full border-b border-[#c9b487]/40 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#efe3c3]"
                            >
                              <div className="text-sm font-medium text-[#2a1a0a]">{location.name}</div>
                              <div className="truncate text-xs text-[#7a6840]">{location.displayName}</div>
                            </button>
                          ))
                        )}

                        {!isSearching && locationSearchResults.length === 0 && (
                          <div className="px-4 py-3 text-sm text-[#7a6840]">No places found — try a specific restaurant, shop, or landmark</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Map Picker - Right Side */}
                <div className="w-2/3">
                  <label className="mb-2 block text-sm font-semibold text-[#4a2c15]">
                    Map preview
                  </label>
                  <div
                    ref={mapPickerRef}
                    className="h-72 w-full overflow-hidden rounded-lg border-2 border-[#c9b487] bg-[#efe3c3]"
                  />
                  {!isMapLoaded && (
                    <button
                      onClick={initMapPicker}
                      className="mt-2 w-full rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] py-2 font-medium text-[#4a2c15] shadow-[0_2px_0_#b89f6a] transition hover:bg-[#e8d9b5]"
                    >
                      Load Map
                    </button>
                  )}
                </div>
              </div>

              {locationCoords && (
                <div className="rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] p-3">
                  <p className="text-sm text-[#4a2c15]">
                    📍 Coordinates: {locationCoords.lat.toFixed(4)},{" "}
                    {locationCoords.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          )}

          {(submitError || submitNotice || uploadedMemory || isSubmitting) && (
            <div className="mt-5 rounded-lg border-2 border-[#c9b487] bg-[#efe3c3] p-3 text-sm text-[#2a1a0a]">
              {isSubmitting && <p className="font-medium">{saveButtonLabel}</p>}
              {submitNotice && (
                <p className="mt-2 text-[#3a6a3a]">{submitNotice}</p>
              )}
              {uploadedMemory && !isSubmitting && (
                <p>
                  Uploaded to Pinata. If the wallet transaction failed, you can
                  retry without uploading again.
                </p>
              )}
              {preparedSave && !isSubmitting && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border-2 border-[#c9b487] bg-[#faf1d8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a6840]">
                      Status fee estimate
                    </p>
                    <p className="mt-1 font-medium text-[#2a1a0a]">
                      {preparedSave.isGaslessEstimate
                        ? "Gasless estimate returned"
                        : `Paid fallback fee cap: ${preparedSave.feeCapLabel}`}
                    </p>
                    <p className="mt-1 text-xs text-[#7a6840]">
                      Built from linea_estimateGas with your wallet as the sender.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={confirmEstimatedSave}
                      className="rounded-xl border-2 border-[#c9b487] bg-[#e8c674] px-4 py-3 text-left text-sm font-medium text-[#2a1a0a] shadow-[0_2px_0_#b89f6a] transition hover:bg-[#e0bc60] active:translate-y-[1px] active:shadow-none"
                    >
                      <span className="block">
                        {preparedSave.isGaslessEstimate
                          ? "Continue in wallet"
                          : "Use paid fallback"}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-[#5a4020]">
                        Uses Status estimate values now.
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="rounded-xl border-2 border-[#c9b487] bg-[#e8dcb4] px-4 py-3 text-left text-sm font-medium text-[#9a8760] opacity-60"
                    >
                      <span className="block">Full gasless submit</span>
                      <span className="mt-1 block text-xs font-normal">
                        Waiting on Hoodi RLN fix.
                      </span>
                    </button>
                  </div>
                </div>
              )}
              {submitError && (
                <p className="mt-2 font-medium text-[#c94a4a]">{submitError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="flex items-center justify-between border-t-2 border-[#c9b487] bg-[#efe3c3] px-5 py-3">
          <button
            onClick={() => {
              if (step === "details") setStep("photos");
              else if (step === "location") setStep("details");
              else handleCloseModal();
            }}
            className="px-4 py-2 text-sm font-medium text-[#7a6840] transition hover:text-[#2a1a0a]"
          >
            ← Back
          </button>

          <div className="flex gap-2">
            {["photos", "details", "location"].map((s) => (
              <div
                key={s}
                className={`h-2.5 w-2.5 rounded-full border border-[#c9b487] transition ${
                  s === step ? "bg-[#e8c674]" : "bg-[#ddd0ac]"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step === "photos" && photos.length > 0) setStep("details");
              else if (step === "details" && title) setStep("location");
              else if (step === "location" && locationCoords) prepareSave();
            }}
            className={`rounded-xl border-2 px-6 py-2 font-medium shadow-[0_2px_0_#b89f6a] transition active:translate-y-[1px] active:shadow-none ${
              (step === "photos" && photos.length === 0) ||
              (step === "details" && !title) ||
              (step === "location" && !locationCoords) ||
              isSubmitting
                ? "border-[#c9b487] bg-[#e8dcb4] text-[#9a8760] cursor-not-allowed"
                : "border-[#c9b487] bg-[#e8c674] text-[#2a1a0a] hover:bg-[#e0bc60]"
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
          border-color: #a08555 !important;
          background-color: #e8d9b5 !important;
        }
      `}</style>
    </div>
  );
}
