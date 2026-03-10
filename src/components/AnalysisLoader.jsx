import React, { useState, useEffect } from 'react';

const ANALYSIS_STEPS = [
    { id: 1, text: 'Analyzing site photograph...' },
    { id: 2, text: 'Assessing soil and terrain conditions...' },
    { id: 3, text: 'Calculating foundation requirements...' },
    { id: 4, text: 'Designing concrete mix ratios...' },
    { id: 5, text: 'Estimating materials and quantities...' },
    { id: 6, text: 'Generating step-by-step construction guide...' },
    { id: 7, text: 'Compiling your engineering blueprint...' },
];

export default function AnalysisLoader() {
    const [activeStep, setActiveStep] = useState(0);
    const [showSlowMsg, setShowSlowMsg] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep(prev => {
                if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
                return prev;
            });
        }, 2500);

        const slowTimer = setTimeout(() => setShowSlowMsg(true), 25000);

        return () => {
            clearInterval(interval);
            clearTimeout(slowTimer);
        };
    }, []);

    return (
        <div className="loader-container">
            <div className="loader-spinner"></div>
            <h2 className="loader-title">Building Your Blueprint</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Our AI engineer is analyzing your project...
            </p>

            <div className="loader-steps">
                {ANALYSIS_STEPS.map((step, index) => (
                    <div
                        key={step.id}
                        className={`loader-step ${index < activeStep ? 'done' : index === activeStep ? 'active' : ''}`}
                    >
                        <span className="loader-step-icon">
                            {index < activeStep ? '✅' : index === activeStep ? '⚡' : '⏳'}
                        </span>
                        <span>{step.text}</span>
                    </div>
                ))}
            </div>

            {showSlowMsg && (
                <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    background: 'rgba(255, 180, 0, 0.1)',
                    border: '1px solid rgba(255, 180, 0, 0.3)',
                    borderRadius: '10px',
                    color: '#ffb400',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                    lineHeight: '1.5'
                }}>
                    ⏳ Taking longer than expected — the AI is retrying different models. Please wait...
                </div>
            )}
        </div>
    );
}
