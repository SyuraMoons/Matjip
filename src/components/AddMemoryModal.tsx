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
  reward?: number;
  multiplier?: number;
  zoneLevel?: number;
};

type KarmaInfo = {
  address: string;
  karmaBalance: string;
  tierId: number;
  tierName: string;
  txPerEpoch: number;
  gaslessEligible: boolean;
  source: "official" | "matjip";
};

type KarmaSummary = {
  address: string;
  official?: KarmaInfo;
  matjip?: KarmaInfo;
  errors?: {
    official?: string;
    matjip?: string;
  };
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
    try {
      const response = await fetch(`/api/karma/${address}`);
      const karmaSummary = (await response.json()) as KarmaSummary & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(karmaSummary.error || "Unable to check Karma");
      }

      const officialBalance = karmaSummary.official
        ? BigInt(karmaSummary.official.karmaBalance)
        : BigInt(0);
      const matjipBalance = karmaSummary.matjip
        ? BigInt(karmaSummary.matjip.karmaBalance)
        : BigInt(0);
      const hasOfficialKarma =
        Boolean(karmaSummary.official?.gaslessEligible) &&
        officialBalance > BigInt(0);

      if (!hasOfficialKarma) {
        setSubmitNotice(
          matjipBalance > BigInt(0)
            ? "Demo Matjip Karma found, but real Status Karma controls official gasless eligibility. The wallet can still use the current Hoodi paid fallback."
            : "No real Status Karma found yet. Demo Matjip Karma is earned when 5 connected memories reveal a larger area."
        );
      } else if (karmaSummary.errors?.matjip) {
        setSubmitNotice(
          "Real Status Karma found. Demo Matjip Karma is unavailable right now, so connected rewards may refresh later."
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseModal();
        }
      }}
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
            onClick={handleCloseModal}
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
                  {!isMapLoaded && (
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

          {(submitError || submitNotice || uploadedMemory || isSubmitting) && (
            <div className="mt-6 rounded-lg border border-purple-500/30 bg-slate-950/70 p-3 text-sm text-gray-200">
              {isSubmitting && <p>{saveButtonLabel}</p>}
              {submitNotice && (
                <p className="mt-2 text-emerald-200">{submitNotice}</p>
              )}
              {uploadedMemory && !isSubmitting && (
                <p>
                  Uploaded to Pinata. If the wallet transaction failed, you can
                  retry without uploading again.
                </p>
              )}
              {preparedSave && !isSubmitting && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-purple-500/30 bg-slate-900/80 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                      Status fee estimate
                    </p>
                    <p className="mt-1 text-gray-100">
                      {preparedSave.isGaslessEstimate
                        ? "Gasless estimate returned"
                        : `Paid fallback fee cap: ${preparedSave.feeCapLabel}`}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Built from linea_estimateGas with your wallet as the sender.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={confirmEstimatedSave}
                      className="rounded-lg bg-purple-600 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-purple-700"
                    >
                      <span className="block">
                        {preparedSave.isGaslessEstimate
                          ? "Continue in wallet"
                          : "Use paid fallback"}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-purple-100">
                        Uses Status estimate values now.
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-purple-500/30 bg-slate-800 px-4 py-3 text-left text-sm font-medium text-gray-400"
                    >
                      <span className="block">Full gasless submit</span>
                      <span className="mt-1 block text-xs font-normal text-gray-500">
                        Waiting on Hoodi RLN fix.
                      </span>
                    </button>
                  </div>
                </div>
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
              else handleCloseModal();
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
              else if (step === "location" && locationCoords) prepareSave();
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
