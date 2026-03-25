import { useState, useRef, useCallback, useEffect } from 'react';

const CameraCapture = ({ onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [error, setError] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);

    // Enumerate all video input devices on component mount
    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(allDevices => {
            const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(videoInputs);
            if (videoInputs.length > 0) {
                setSelectedDevice(videoInputs[0].deviceId);
            }
        }).catch(err => {
            console.error("Error enumerating devices:", err);
            setError("Could not enumerate camera devices.");
        });
    }, []);

    const startCamera = useCallback(async () => {
        setError(null);
        try {
            const constraints = {
                video: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsActive(true);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permission in browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found. Please connect a camera and try again.');
            } else {
                setError(`Camera error: ${err.message}`);
            }
        }
    }, [selectedDevice]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsActive(false);
    }, []);

    // Stop camera when component unmounts
    useEffect(() => () => stopCamera(), [stopCamera]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) {
                setError('Failed to capture image');
                return;
            }
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            setCapturedImage({ file, previewUrl });
            stopCamera();
            onCapture(file);
        }, 'image/jpeg', 0.95);
    }, [onCapture, stopCamera]);

    const retake = () => {
        if (capturedImage) URL.revokeObjectURL(capturedImage.previewUrl);
        setCapturedImage(null);
        startCamera();
    };

    return (
        <div className="camera-capture" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {/* Device Selector */}
            {devices.length > 1 && !isActive && !capturedImage && (
                <select
                    value={selectedDevice}
                    onChange={e => setSelectedDevice(e.target.value)}
                    className="camera-device-selector"
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#333', color: 'white' }}
                >
                    {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${devices.indexOf(d) + 1}`}
                        </option>
                    ))}
                </select>
            )}

            {/* Error Display */}
            {error && <div className="camera-error" style={{ color: '#ff4d4d', padding: '1rem', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>{error}</div>}

            {/* Video Preview */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '600px', aspectRatio: '16/9', overflow: 'hidden', borderRadius: '12px', backgroundColor: '#1a1a1a', display: isActive ? 'block' : 'none' }}>
                <video
                    ref={videoRef}
                    className={`camera-video ${isActive ? 'active' : 'hidden'}`}
                    playsInline
                    muted
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Captured Image Preview */}
            {capturedImage && (
                <div style={{ width: '100%', maxWidth: '600px', borderRadius: '12px', overflow: 'hidden' }}>
                    <img
                        src={capturedImage.previewUrl}
                        alt="Captured"
                        className="camera-preview"
                        style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="camera-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                {!isActive && !capturedImage && (
                    <button onClick={startCamera} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📷 Open Camera
                    </button>
                )}
                {isActive && (
                    <>
                        <button onClick={captureFrame} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📸 Capture
                        </button>
                        <button onClick={stopCamera} className="btn-secondary">
                            Cancel
                        </button>
                    </>
                )}
                {capturedImage && (
                    <button onClick={retake} className="btn-secondary">
                        Retake
                    </button>
                )}
            </div>
        </div>
    );
};

export default CameraCapture;
