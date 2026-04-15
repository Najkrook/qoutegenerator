export {};

declare global {
    interface FileSystemWritableFileStream {
        write(data: Blob | BufferSource | string): Promise<void>;
        close(): Promise<void>;
    }

    interface FileSystemFileHandle {
        createWritable(): Promise<FileSystemWritableFileStream>;
    }

    interface Window {
        FEATURE_PDF_LEGAL_TEMPLATES?: boolean;
        FEATURE_QUOTE_LIFECYCLE?: boolean;
        showSaveFilePicker?: (options?: {
            suggestedName?: string;
            types?: Array<{
                description?: string;
                accept: Record<string, string[]>;
            }>;
        }) => Promise<FileSystemFileHandle>;
    }
}
