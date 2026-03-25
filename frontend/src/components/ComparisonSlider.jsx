import { useState, useRef, useEffect } from 'react';

const ComparisonSlider = ({ originalSrc, enhancedSrc }) => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef(null);

    const handleMove = (clientX) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate percentage (0 to 100)
        let pos = ((clientX - rect.left) / rect.width) * 100;
        pos = Math.max(0, Math.min(pos, 100)); // clamp between 0 and 100
        setSliderPos(pos);
    };

    const onMouseMove = (e) => {
        // Only trigger on mouse drag or hover? usually hover is fine for this
        handleMove(e.clientX);
    };

    const onTouchMove = (e) => {
        if (e.touches && e.touches.length > 0) {
            handleMove(e.touches[0].clientX);
        }
    };

    return (
        <div
            ref={containerRef}
            className="comparison-container"
            style={{
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
                borderRadius: '12px',
                cursor: 'crosshair',
                aspectRatio: '16/9',
                backgroundColor: '#1a1a1a'
            }}
            onMouseMove={onMouseMove}
            onTouchMove={onTouchMove}
        >
            {/* Base image (Enhanced) occupies full width */}
            <img
                src={enhancedSrc}
                alt="Enhanced"
                className="comparison-enhanced"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                }}
            />

            {/* Overlay image (Original) clipped by slider position */}
            <div
                className="comparison-original-wrapper"
                style={{
                    position: 'absolute',
                    top: 0, left: 0, bottom: 0,
                    width: `${sliderPos}%`,
                    overflow: 'hidden'
                }}
            >
                <img
                    src={originalSrc}
                    alt="Original"
                    className="comparison-original"
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        // Maintain the original width ratio despite wrapper being clipped
                        maxWidth: 'none',
                        minWidth: containerRef.current ? containerRef.current.clientWidth : '100%'
                    }}
                />
            </div>

            {/* Handle/Slider Line */}
            <div
                className="comparison-handle"
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${sliderPos}%`,
                    width: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    transform: 'translateX(-50%)',
                    cursor: 'ew-resize',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                {/* Visual grabber circle */}
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                        <path d="M9 18l6-6-6-6" style={{ transform: 'translateX(6px)' }} />
                    </svg>
                </div>
            </div>

            {/* Labels */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'white', opacity: 0.8, pointerEvents: 'none' }}>Original</div>
            <div style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'white', opacity: 0.8, pointerEvents: 'none' }}>Enhanced</div>
        </div>
    );
};

export default ComparisonSlider;
