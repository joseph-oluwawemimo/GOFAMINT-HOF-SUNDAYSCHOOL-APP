import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Upload, FlipHorizontal, AlertCircle } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Photo: string) => void;
  title?: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Take Profile Photo'
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start Camera
  const startCamera = async (mode: 'user' | 'environment') => {
    setIsLoading(true);
    setCameraError(null);

    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Camera could not be accessed directly. You can still upload a photo from your gallery/files below.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera(facingMode);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth, video.videoHeight) || 400;
    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center crop square
    const startX = (video.videoWidth - size) / 2 || 0;
    const startY = (video.videoHeight - size) / 2 || 0;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);

    const base64 = canvas.toDataURL('image/jpeg', 0.82);
    setCapturedPhoto(base64);

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      handleClose();
    }
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedPhoto(null);
    setCameraError(null);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 400, 400);
          const base64 = canvas.toDataURL('image/jpeg', 0.82);
          setCapturedPhoto(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Camera className="w-4 h-4 text-blue-900" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Captured Photo Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-300 shadow-inner flex items-center justify-center">
            
            {capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Captured Snapshot"
                className="w-full h-full object-cover"
              />
            ) : cameraError ? (
              <div className="p-4 text-center">
                <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                <p className="text-xs text-slate-600 mb-3">{cameraError}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 mx-auto shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Photo File</span>
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                
                {/* Visual Target Frame */}
                <div className="absolute inset-4 border border-white/50 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-2 border-dashed border-amber-400 pointer-events-none" />
                </div>

                {isLoading && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Action Buttons */}
          <div className="w-full mt-5 flex items-center justify-center gap-3">
            {capturedPhoto ? (
              <>
                <button
                  id="camera-btn-retake"
                  onClick={handleRetake}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retake</span>
                </button>

                <button
                  id="camera-btn-confirm"
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Photo</span>
                </button>
              </>
            ) : (
              <>
                <button
                  id="camera-btn-flip"
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition"
                  title="Switch Front/Back Camera"
                >
                  <FlipHorizontal className="w-5 h-5" />
                </button>

                <button
                  id="camera-btn-capture"
                  onClick={handleSnap}
                  disabled={isLoading || !!cameraError}
                  className="px-6 py-3 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg font-bold text-sm flex items-center gap-2.5 shadow-xs transition transform active:scale-95"
                >
                  <Camera className="w-5 h-5 text-amber-300" />
                  <span>Capture Snap</span>
                </button>

                <button
                  id="camera-btn-upload-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition"
                  title="Upload from Device Storage"
                >
                  <Upload className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
