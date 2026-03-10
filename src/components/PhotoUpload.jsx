import React, { useRef, useState } from 'react';

const PHOTO_SLOTS = [
    {
        id: 'front',
        label: 'Front View',
        icon: '🏠',
        description: 'Photo from the front',
        guide: 'Stand 15-20 feet away facing the front of the site. Include the full width of the plot, any existing structures, roads, or boundaries.',
        tips: ['Stand straight, don\'t tilt the camera', 'Include the ground and sky', 'Take during daylight']
    },
    {
        id: 'left',
        label: 'Left Side',
        icon: '⬅️',
        description: 'Photo from the left side',
        guide: 'Stand at the left side of the plot looking at the right edge. Capture the full depth and any neighboring structures.',
        tips: ['Show the boundary clearly', 'Include vegetation if any', 'Capture the slope if present']
    },
    {
        id: 'right',
        label: 'Right Side',
        icon: '➡️',
        description: 'Photo from the right side',
        guide: 'Stand at the right side of the plot looking at the left edge. Show the terrain and any adjacent buildings or roads.',
        tips: ['Capture drainage direction', 'Show nearby buildings', 'Include access road if visible']
    },
    {
        id: 'ground',
        label: 'Ground Close-up',
        icon: '🌱',
        description: 'Close-up of the soil',
        guide: 'Crouch down and take a close photo of the ground surface. This helps the AI determine soil type and texture.',
        tips: ['Get within 2-3 feet of the ground', 'Show soil color and texture', 'Include any visible cracks or stones', 'Add a coin/pen for scale reference']
    },
];

export default function PhotoUpload({ onPhotosUpdate, photos = {} }) {
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const [activeSlot, setActiveSlot] = useState(null);
    const [previews, setPreviews] = useState({});
    const [showGuide, setShowGuide] = useState(true);

    const handleFile = (file) => {
        if (!file || !activeSlot) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a photo (JPEG, PNG, or WebP format).');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            alert('File too large. Please upload an image under 20MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setPreviews(prev => ({ ...prev, [activeSlot]: e.target.result }));
        };
        reader.readAsDataURL(file);

        const updatedPhotos = { ...photos, [activeSlot]: file };
        onPhotosUpdate(updatedPhotos);
        setActiveSlot(null);
    };

    const handleSlotClick = (slotId) => {
        setActiveSlot(slotId);
        fileInputRef.current?.click();
    };

    const handleCameraClick = (slotId) => {
        setActiveSlot(slotId);
        cameraInputRef.current?.click();
    };

    const handleRemovePhoto = (slotId, e) => {
        e.stopPropagation();
        const updatedPreviews = { ...previews };
        delete updatedPreviews[slotId];
        setPreviews(updatedPreviews);

        const updatedPhotos = { ...photos };
        delete updatedPhotos[slotId];
        onPhotosUpdate(updatedPhotos);
    };

    const uploadedCount = Object.keys(photos).length;

    return (
        <div className="photo-upload-container animate-in">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => handleFile(e.target.files[0])}
            />
            <input
                type="file"
                ref={cameraInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFile(e.target.files[0])}
            />

            {/* Photo Guide Banner */}
            {showGuide && (
                <div className="photo-guide-banner glass-card">
                    <div className="guide-header">
                        <span className="guide-icon">📸</span>
                        <div>
                            <strong>Photo Guide — How to take good site photos</strong>
                            <p>Good photos help the AI accurately analyze your soil type, terrain, and surroundings.</p>
                        </div>
                        <button className="guide-close" onClick={() => setShowGuide(false)}>✕</button>
                    </div>
                    <div className="guide-tips-grid">
                        <div className="guide-tip">✅ Take photos during <strong>daylight</strong></div>
                        <div className="guide-tip">✅ Hold the camera <strong>steady</strong> (no blur)</div>
                        <div className="guide-tip">✅ Include <strong>full width</strong> of the plot</div>
                        <div className="guide-tip">✅ Show the <strong>ground surface</strong> clearly</div>
                        <div className="guide-tip">❌ Don't use <strong>zoomed-in</strong> photos</div>
                        <div className="guide-tip">❌ Don't use <strong>filtered</strong> or edited photos</div>
                    </div>
                </div>
            )}

            {/* Progress indicator */}
            <div className="upload-progress">
                <div className="upload-progress-bar">
                    <div className="upload-progress-fill" style={{ width: `${(uploadedCount / 4) * 100}%` }} />
                </div>
                <span className="upload-progress-text">{uploadedCount} of 4 photos uploaded</span>
            </div>

            <div className="upload-grid">
                {PHOTO_SLOTS.map((slot) => (
                    <div
                        key={slot.id}
                        className={`photo-slot glass-card ${previews[slot.id] ? 'has-image' : ''}`}
                        onClick={() => !previews[slot.id] && handleSlotClick(slot.id)}
                    >
                        {previews[slot.id] ? (
                            <>
                                <img src={previews[slot.id]} alt={slot.label} className="slot-preview" />
                                <div className="slot-overlay">
                                    <button className="btn-icon" onClick={(e) => handleRemovePhoto(slot.id, e)}>🗑️</button>
                                    <button className="btn-icon" onClick={() => handleSlotClick(slot.id)}>🔄</button>
                                </div>
                                <div className="slot-done-badge">✓</div>
                            </>
                        ) : (
                            <div className="slot-empty">
                                <div className="slot-icon">{slot.icon}</div>
                                <div className="slot-label">{slot.label}</div>
                                <div className="slot-guide">{slot.guide}</div>
                                <div className="slot-tips">
                                    {slot.tips.map((tip, i) => (
                                        <span key={i} className="slot-tip-tag">💡 {tip}</span>
                                    ))}
                                </div>
                                <div className="slot-actions">
                                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleSlotClick(slot.id); }}>📁 Gallery</button>
                                    <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleCameraClick(slot.id); }}>📷 Camera</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <style>{`
                .photo-upload-container {
                    margin-bottom: 24px;
                }
                /* Guide Banner */
                .photo-guide-banner {
                    padding: 16px 20px;
                    margin-bottom: 16px;
                    border: 1px solid rgba(59,130,246,0.2);
                    background: rgba(59,130,246,0.05);
                }
                .guide-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .guide-icon { font-size: 1.5rem; }
                .guide-header strong { display: block; margin-bottom: 2px; }
                .guide-header p { font-size: 0.8rem; color: var(--text-secondary); margin: 0; }
                .guide-close {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 1rem;
                    padding: 4px;
                }
                .guide-tips-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                }
                @media (max-width: 600px) {
                    .guide-tips-grid { grid-template-columns: repeat(2, 1fr); }
                }
                .guide-tip {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    padding: 4px 8px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 6px;
                }

                /* Upload Progress */
                .upload-progress {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .upload-progress-bar {
                    flex: 1;
                    height: 6px;
                    background: rgba(255,255,255,0.08);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .upload-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent-blue), var(--accent-emerald));
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }
                .upload-progress-text {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    white-space: nowrap;
                }

                .upload-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }
                @media (max-width: 600px) {
                    .upload-grid {
                        grid-template-columns: 1fr;
                    }
                }
                .photo-slot {
                    position: relative;
                    min-height: 220px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px dashed rgba(255, 255, 255, 0.2);
                }
                .photo-slot.has-image {
                    border-style: solid;
                    border-color: var(--accent-emerald);
                }
                .photo-slot:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: var(--accent-blue);
                }
                .slot-preview {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    position: absolute;
                    inset: 0;
                }
                .slot-done-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--accent-emerald);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.7rem;
                    font-weight: 700;
                    z-index: 5;
                }
                .slot-empty {
                    text-align: center;
                    padding: 16px;
                }
                .slot-icon {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }
                .slot-label {
                    font-weight: 600;
                    font-size: 0.9rem;
                    margin-bottom: 4px;
                }
                .slot-guide {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                    margin-bottom: 8px;
                }
                .slot-tips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    justify-content: center;
                    margin-bottom: 10px;
                }
                .slot-tip-tag {
                    font-size: 0.65rem;
                    color: var(--accent-amber);
                    background: rgba(245,158,11,0.08);
                    padding: 2px 6px;
                    border-radius: 4px;
                    border: 1px solid rgba(245,158,11,0.15);
                }
                .slot-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: center;
                }
                .btn-sm {
                    padding: 4px 8px;
                    font-size: 0.8rem;
                }
                .slot-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    z-index: 3;
                }
                .photo-slot:hover .slot-overlay {
                    opacity: 1;
                }
                .btn-icon {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 1.1rem;
                }
                .btn-icon:hover {
                    background: rgba(255,255,255,0.4);
                }
            `}</style>
        </div>
    );
}
