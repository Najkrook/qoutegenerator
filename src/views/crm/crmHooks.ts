import { useCallback, useEffect, useState } from 'react';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { AccessUser } from '../../types/contracts';
import type { CrmActor } from '../../types/crm';

export function getCrmActor(user: AccessUser | null): CrmActor {
    return {
        uid: String(user?.uid || ''),
        email: String(user?.email || '')
    };
}

export interface CrmAsyncState<T> {
    data: T;
    loading: boolean;
    error: string;
    reload: () => void;
}

async function ensureCurrentCrmMember(user: AccessUser | null): Promise<void> {
    const memberId = String(user?.uid || '').trim();
    if (!memberId) return;

    const existingMember = await crmRepository.getMember(memberId);
    if (existingMember) return;

    const email = String(user?.email || '').trim();
    const displayName = typeof user?.displayName === 'string'
        ? user.displayName.trim()
        : '';
    const name = displayName || email.split('@')[0] || 'BRIXX-användare';
    await crmRepository.createMember({
        id: memberId,
        name,
        email,
        actor: {
            uid: memberId,
            name,
            email
        }
    });
}

export function useCrmLoader<T>(
    load: () => Promise<T>,
    initialData: T,
    errorMessage: string
): CrmAsyncState<T> {
    const { user, canViewEverything } = useAuth();
    const [data, setData] = useState<T>(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const reload = useCallback(() => setReloadKey((current) => current + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');

        const prepareMember = canViewEverything
            ? ensureCurrentCrmMember(user)
            : Promise.resolve();

        void prepareMember
            .then(load)
            .then((nextData) => {
                if (!cancelled) setData(nextData);
            })
            .catch((loadError) => {
                console.error(errorMessage, loadError);
                if (!cancelled) setError(errorMessage);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        canViewEverything,
        errorMessage,
        load,
        reloadKey,
        user?.displayName,
        user?.email,
        user?.uid
    ]);

    return { data, loading, error, reload };
}
