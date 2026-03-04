export function downloadBlob(blob, fileName) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}

export async function saveBlobWithPicker(blob, fileName) {
    if (typeof window.showSaveFilePicker !== 'function') {
        return 'unavailable';
    }

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [
                {
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] }
                }
            ]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return 'saved';
    } catch (err) {
        if (err.name === 'AbortError') {
            return 'canceled';
        }
        console.error('Save file picker failed:', err);
        return 'failed';
    }
}
