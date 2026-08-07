import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "../utils/cropImage";
import { useLanguage } from "../context/LanguageContext";

export default function AvatarCropModal({ imageSrc, onCropComplete, onCancel }) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels || !imageSrc || isApplying) return;
    try {
      setIsApplying(true);
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedFile);
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-surface-container-lowest cloud-shadow">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-container-low px-lg py-md">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">
            {t("profile.cropAvatar") || "Обрезка аватара"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative h-72 w-full bg-surface-container-highest sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* Controls & Actions */}
        <div className="space-y-md p-lg">
          {/* Zoom Slider */}
          <div className="flex items-center gap-md">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              zoom_out
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-primary"
              aria-label="Zoom"
            />
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              zoom_in
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-sm pt-xs">
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="flex-1 rounded-full bg-surface-container-highest py-sm text-label-lg font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || !croppedAreaPixels}
              className="flex-1 rounded-full bg-primary py-sm text-label-lg font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98] disabled:opacity-50"
            >
              {isApplying
                ? t("common.loading") || "Загрузка..."
                : t("common.apply") || "Применить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
