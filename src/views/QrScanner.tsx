import React, { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import {
    IconAlertTriangle,
    IconArrowRight,
    IconCamera,
    IconKeyboard,
    IconScan,
    IconX
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { APP_PATHS, APP_ROUTE_IDS, getQrParasolPath } from '../navigation/routes';
import { parseBahamaQrInput } from '../services/bahamaQrService';

type ScannerState = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';

function getCameraErrorState(error: unknown): ScannerState {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    return 'error';
}

export function QrScanner() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const decodedRef = useRef(false);
    const [state, setState] = useState<ScannerState>('idle');
    const [manualInput, setManualInput] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    const stopScanner = () => {
        controlsRef.current?.stop();
        controlsRef.current = null;
    };

    const openQrValue = (value: string): boolean => {
        const qrId = parseBahamaQrInput(value, window.location.origin);
        if (!qrId) {
            setMessage('Koden är inte en giltig BRIXX-länk eller ett giltigt QR-ID.');
            return false;
        }
        decodedRef.current = true;
        stopScanner();
        navigate(getQrParasolPath(qrId));
        return true;
    };

    const startScanner = async () => {
        stopScanner();
        decodedRef.current = false;
        setMessage(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            setState('unsupported');
            return;
        }
        if (!videoRef.current) return;

        setState('requesting');
        try {
            const { BrowserQRCodeReader } = await import('@zxing/browser');
            const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 180 });
            const controls = await reader.decodeFromConstraints(
                { audio: false, video: { facingMode: { ideal: 'environment' } } },
                videoRef.current,
                (result) => {
                    if (!result || decodedRef.current) return;
                    const opened = openQrValue(result.getText());
                    if (!opened) {
                        window.setTimeout(() => setMessage(null), 2400);
                    }
                }
            );
            controlsRef.current = controls;
            setState('active');
        } catch (error) {
            console.error('Failed to start QR scanner:', error);
            setState(getCameraErrorState(error));
        }
    };

    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                stopScanner();
                setState((current) => current === 'active' ? 'idle' : current);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            stopScanner();
        };
    }, []);

    const stateText = state === 'requesting'
        ? 'Väntar på kameran…'
        : state === 'active'
            ? 'Håll QR-koden innanför kamerabilden'
            : state === 'denied'
                ? 'Kameraåtkomst nekades. Tillåt kameran i webbläsarens inställningar eller använd manuell öppning.'
                : state === 'unsupported'
                    ? 'Den här webbläsaren kan inte använda kameran. Öppna länken manuellt i stället.'
                    : state === 'error'
                        ? 'Kameran kunde inte startas. Kontrollera att ingen annan app använder den.'
                        : 'Starta kameran när du är redo att skanna.';

    return (
        <div className="mx-auto min-h-0 w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0c111b] text-slate-100 shadow-2xl">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d4c8b4]">BaHaMa lager</p>
                    <h1 className="m-0 mt-1 text-xl font-semibold">Skanna parasoll</h1>
                </div>
                <button type="button" onClick={() => navigate(APP_PATHS[APP_ROUTE_IDS.dashboard])} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Stäng skannern">
                    <IconX size={20} />
                </button>
            </header>

            <main className="p-4 sm:p-6">
                <section className="relative aspect-[4/5] max-h-[50dvh] overflow-hidden rounded-2xl border border-white/10 bg-[#080b11] sm:aspect-[4/3] sm:max-h-[560px]">
                    <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${state === 'active' ? 'opacity-100' : 'opacity-20'}`} />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-gradient-to-b from-transparent via-transparent to-black/35">
                        <IconScan size={148} stroke={1.1} className="text-[#e8e1d4] drop-shadow-xl" aria-hidden="true" />
                    </div>
                    {state !== 'active' && (
                        <div className="absolute inset-0 grid place-items-center px-8 text-center">
                            <div>
                                <IconCamera className="mx-auto text-slate-500" size={44} stroke={1.4} aria-hidden="true" />
                                <p className="mt-4 text-sm leading-6 text-slate-400">{stateText}</p>
                                <button type="button" onClick={() => void startScanner()} disabled={state === 'requesting'} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#e8e1d4] px-5 text-sm font-bold text-[#10161b] hover:bg-white disabled:opacity-50">
                                    <IconCamera size={19} aria-hidden="true" />
                                    {state === 'requesting' ? 'Startar…' : state === 'idle' ? 'Starta kamera' : 'Försök igen'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                <div className="mt-4 min-h-6 text-center text-sm" aria-live="polite">
                    {message ? (
                        <span className="inline-flex items-center gap-2 text-amber-200"><IconAlertTriangle size={17} aria-hidden="true" />{message}</span>
                    ) : state === 'active' ? <span className="text-emerald-300">Kameran är aktiv</span> : state === 'idle' ? null : <span className="text-slate-500">{stateText}</span>}
                </div>

                <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <span className="h-px flex-1 bg-white/10" /><span>eller öppna manuellt</span><span className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={(event) => { event.preventDefault(); openQrValue(manualInput); }} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <label className="relative">
                        <span className="sr-only">BRIXX-länk eller QR-ID</span>
                        <IconKeyboard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                        <input value={manualInput} onChange={(event) => { setManualInput(event.target.value); setMessage(null); }} placeholder="Klistra in länk eller QR-ID" autoComplete="off" className="w-full rounded-lg border border-white/10 bg-[#111722] py-3 pl-10 pr-3 text-base text-white outline-none placeholder:text-slate-400 focus:border-[#e8e1d4]" />
                    </label>
                    <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-5 text-sm font-semibold text-white hover:bg-white/[0.09]">
                        Öppna <IconArrowRight size={18} aria-hidden="true" />
                    </button>
                </form>
            </main>
        </div>
    );
}
