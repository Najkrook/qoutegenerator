import type { QuoteMetadata } from '../types/contracts';
import type { CrmActor, CrmDeal, CrmDealStage } from '../types/crm';
import { crmRepository } from './crmRepository';

interface SyncCrmDealFromQuoteInput {
    metadata: Pick<
        QuoteMetadata,
        'quoteId' | 'quoteNumber' | 'latestRevisionId' | 'latestVersion' | 'totalSek' | 'status' | 'crmDealId'
    >;
    quoteOwnerUid: string;
    actor: CrmActor;
}

interface ChangeCrmDealStageWithQuoteInput {
    dealId: string;
    stage: CrmDealStage;
    lostReason?: string;
    actor: CrmActor;
}

export async function syncCrmDealFromQuote({
    metadata,
    quoteOwnerUid,
    actor
}: SyncCrmDealFromQuoteInput): Promise<CrmDeal | null> {
    const dealId = String(metadata.crmDealId || '').trim();
    if (!dealId || !metadata.quoteId || !quoteOwnerUid) {
        return null;
    }

    return crmRepository.syncDealFromQuote({
        dealId,
        quoteOwnerUid,
        quoteId: metadata.quoteId,
        quoteNumber: metadata.quoteNumber,
        quoteRevisionId: metadata.latestRevisionId || null,
        quoteVersion: metadata.latestVersion || null,
        valueSek: Number(metadata.totalSek) || 0,
        quoteStatus: metadata.status,
        user: actor
    });
}

export async function changeCrmDealStageWithQuote({
    dealId,
    stage,
    lostReason,
    actor
}: ChangeCrmDealStageWithQuoteInput): Promise<CrmDeal> {
    const currentDeal = await crmRepository.getDeal(dealId);
    if (!currentDeal) {
        throw new Error('CRM-affären kunde inte hittas.');
    }

    if (stage === 'quote' && !currentDeal.quoteId) {
        throw new Error('Koppla eller skapa en offert innan affären flyttas till Offert.');
    }

    return crmRepository.changeDealStage({
        dealId,
        stage,
        lostReason,
        actor
    });
}
