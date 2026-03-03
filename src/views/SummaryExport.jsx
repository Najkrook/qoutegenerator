import React from 'react';
import { useQuote } from '../store/QuoteContext';
import { catalogData } from '../data/catalog';
import { computeQuoteTotals } from '../../services/calculationEngine';
import { CustomerInfoForm } from '../components/features/CustomerInfoForm';
import { FinalSummaryTable } from '../components/features/FinalSummaryTable';
import { generatePDF } from '../../features/pdfExport';
import { generateExcel } from '../../features/excelExport';

export function SummaryExport() {
    const { state, dispatch } = useQuote();
    const summaryData = computeQuoteTotals({ state, catalogData });

    const handleBack = () => {
        dispatch({ type: 'SET_STEP', payload: 3 });
    };

    const handleExportPDF = () => {
        generatePDF(state, summaryData);
    };

    const handleExportExcel = () => {
        generateExcel(state, summaryData);
    };

    const handleSaveQuote = () => {
        // Firebase save logic would go here
        alert('Offert sparad! (Firebase-integration kommer i nästa fas)');
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Offertsammanställning</h2>
                    <p className="text-text-secondary mt-1">Granska kunduppgifter och slutgiltiga belopp före export.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveQuote}
                        className="px-6 py-2.5 bg-panel-bg border border-panel-border text-text-primary rounded-lg font-bold hover:bg-white/5 transition-all text-sm uppercase tracking-wide"
                    >
                        Spara Offert
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <section>
                    <CustomerInfoForm />
                </section>

                <section className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="text-primary text-xl">📋</span> Summering
                    </h3>
                    <FinalSummaryTable />
                </section>

                <section className="flex flex-col md:flex-row justify-between items-center gap-6 mt-4 p-8 bg-black/40 border border-panel-border rounded-xl">
                    <button
                        onClick={handleBack}
                        className="text-text-secondary hover:text-white transition-colors flex items-center gap-2 group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> Tillbaka för att ändra priser
                    </button>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleExportPDF}
                            className="px-8 py-4 bg-primary text-white rounded-lg font-black hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all uppercase tracking-wider flex items-center gap-3"
                        >
                            <span>📄</span> Exportera som PDF
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="px-8 py-4 bg-success text-white rounded-lg font-black hover:bg-success-hover shadow-lg shadow-success/20 transition-all uppercase tracking-wider flex items-center gap-3"
                        >
                            <span>📊</span> Exportera som Excel
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
