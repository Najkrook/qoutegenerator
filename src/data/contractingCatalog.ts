import type { ContractingWorkProvider } from '../types/contracts';

interface ContractingService {
    id: string;
    name: string;
    scope?: string;
    unitPriceExVatSek: number;
}

export const contractingCatalog: Record<ContractingWorkProvider, {
    name: string;
    services: readonly ContractingService[];
}> = {
    'stabil-entreprenad': {
        name: 'Stabil Entreprenad',
        services: [
            {
                id: 'stabil-tri-base-markskruvsinstallation',
                name: 'TRI-BASE Markskruvsinstallation',
                unitPriceExVatSek: 7500,
                scope: 'Körersättning ingår'
            },
            {
                id: 'stabil-parasollmontering',
                name: 'Montering av parasoll',
                unitPriceExVatSek: 1000,
                scope: 'Körersättning ingår'
            }
        ]
    },
    'tavi-co': { name: 'Tavi&Co', services: [] }
};

export function isContractingWorkProvider(value: unknown): value is ContractingWorkProvider {
    return typeof value === 'string' && Object.hasOwn(contractingCatalog, value);
}
