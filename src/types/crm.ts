export const CRM_DEAL_STAGES = ['lead', 'quote', 'won', 'lost'] as const;
export type CrmDealStage = typeof CRM_DEAL_STAGES[number];

export const CRM_ACTIVITY_TYPES = ['note', 'call', 'email', 'meeting', 'task'] as const;
export type CrmActivityType = typeof CRM_ACTIVITY_TYPES[number];

export const CRM_ACTIVITY_STATUSES = ['open', 'completed'] as const;
export type CrmActivityStatus = typeof CRM_ACTIVITY_STATUSES[number];

export interface CrmActor {
    uid: string;
    name?: string;
    email?: string;
}

export interface CrmAddress {
    street: string;
    postalCode: string;
    city: string;
    country: string;
}

export interface CrmAuditFields {
    schemaVersion: 1;
    archived: boolean;
    archivedAtMs: number | null;
    archivedByUid: string;
    createdAtMs: number;
    updatedAtMs: number;
    createdByUid: string;
    createdByName: string;
    updatedByUid: string;
    updatedByName: string;
}

export interface CrmSearchFields {
    searchText: string;
    searchPrefixes: string[];
}

export interface CrmCompany extends CrmAuditFields, CrmSearchFields {
    id: string;
    name: string;
    normalizedName: string;
    orgNumber: string;
    email: string;
    phone: string;
    website: string;
    address: CrmAddress;
    tags: string[];
    notes: string;
}

export interface CrmContact extends CrmAuditFields, CrmSearchFields {
    id: string;
    companyId: string | null;
    name: string;
    normalizedName: string;
    firstName: string;
    lastName: string;
    email: string;
    normalizedEmail: string;
    phone: string;
    role: string;
    tags: string[];
    notes: string;
}

export interface CrmDeal extends CrmAuditFields, CrmSearchFields {
    id: string;
    title: string;
    companyId: string | null;
    primaryContactId: string | null;
    ownerId: string | null;
    ownerName: string;
    stage: CrmDealStage;
    valueSek: number;
    expectedCloseAtMs: number | null;
    lostReason: string;
    quoteOwnerUid: string | null;
    quoteId: string | null;
    quoteNumber: string | null;
    quoteRevisionId: string | null;
    quoteVersion: number | null;
    lastActivityAtMs: number | null;
    nextActivityAtMs: number | null;
    tags: string[];
}

export interface CrmActivity extends CrmAuditFields, CrmSearchFields {
    id: string;
    type: CrmActivityType;
    status: CrmActivityStatus;
    subject: string;
    notes: string;
    companyId: string | null;
    contactId: string | null;
    dealId: string | null;
    assignedToId: string | null;
    assignedToName: string;
    occurredAtMs: number;
    dueAtMs: number | null;
    completedAtMs: number | null;
}

export interface CrmMember extends CrmAuditFields, CrmSearchFields {
    id: string;
    name: string;
    email: string;
    normalizedEmail: string;
    phone: string;
    title: string;
}

export interface CrmPageCursor {
    sortValue: number;
    id: string;
}

export interface CrmPage<T> {
    items: T[];
    nextCursor: CrmPageCursor | null;
}

export interface CrmListOptions {
    search?: string;
    includeArchived?: boolean;
    pageSize?: number;
    cursor?: CrmPageCursor | null;
}

export interface CrmCompanyDuplicateQuery {
    name?: string;
    orgNumber?: string;
    excludeCompanyId?: string;
    includeArchived?: boolean;
}

export interface CrmContactDuplicateQuery {
    companyId?: string | null;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    excludeContactId?: string;
    includeArchived?: boolean;
}

export interface CrmContactListOptions extends CrmListOptions {
    companyId?: string | null;
}

export interface CrmDealListOptions extends CrmListOptions {
    companyId?: string | null;
    ownerId?: string | null;
    stage?: CrmDealStage | '';
}

export interface CrmActivityListOptions extends CrmListOptions {
    companyId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    type?: CrmActivityType | '';
    status?: CrmActivityStatus | '';
    dueBeforeMs?: number | null;
    dueAfterMs?: number | null;
}

export interface CrmSearchOptions {
    query: string;
    includeArchived?: boolean;
    pageSize?: number;
}

export interface CrmSearchResults {
    companies: CrmPage<CrmCompany>;
    contacts: CrmPage<CrmContact>;
    deals: CrmPage<CrmDeal>;
}

export interface CrmCreateCompanyInput {
    actor: CrmActor;
    id?: string;
    name: string;
    orgNumber?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: Partial<CrmAddress>;
    tags?: string[];
    notes?: string;
}

export type CrmCompanyPatch = Partial<Pick<
    CrmCompany,
    'name' | 'orgNumber' | 'email' | 'phone' | 'website' | 'tags' | 'notes'
>> & {
    address?: Partial<CrmAddress>;
};

export interface CrmUpdateCompanyInput {
    companyId: string;
    actor: CrmActor;
    patch: CrmCompanyPatch;
}

export interface CrmArchiveCompanyInput {
    companyId: string;
    actor: CrmActor;
}

export interface CrmCreateContactInput {
    actor: CrmActor;
    id?: string;
    companyId?: string | null;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: string;
    tags?: string[];
    notes?: string;
}

export type CrmContactPatch = Partial<Pick<
    CrmContact,
    'companyId' | 'name' | 'firstName' | 'lastName' | 'email' | 'phone' | 'role' | 'tags' | 'notes'
>>;

export interface CrmUpdateContactInput {
    contactId: string;
    actor: CrmActor;
    patch: CrmContactPatch;
}

export interface CrmArchiveContactInput {
    contactId: string;
    actor: CrmActor;
}

export interface CrmCreateDealInput {
    actor: CrmActor;
    id?: string;
    title: string;
    companyId?: string | null;
    primaryContactId?: string | null;
    ownerId?: string | null;
    ownerName?: string;
    stage?: CrmDealStage;
    valueSek?: number;
    expectedCloseAtMs?: number | null;
    lostReason?: string;
    tags?: string[];
    quoteOwnerUid?: string | null;
    quoteId?: string | null;
    quoteNumber?: string | null;
    quoteRevisionId?: string | null;
    quoteVersion?: number | null;
}

export type CrmDealPatch = Partial<Pick<
    CrmDeal,
    | 'title'
    | 'companyId'
    | 'primaryContactId'
    | 'ownerId'
    | 'ownerName'
    | 'valueSek'
    | 'expectedCloseAtMs'
    | 'tags'
>>;

export interface CrmUpdateDealInput {
    dealId: string;
    actor: CrmActor;
    patch: CrmDealPatch;
}

export interface CrmArchiveDealInput {
    dealId: string;
    actor: CrmActor;
}

export interface CrmChangeDealStageInput {
    dealId: string;
    stage: CrmDealStage;
    lostReason?: string;
    actor: CrmActor;
}

export interface CrmCreateActivityInput {
    actor: CrmActor;
    id?: string;
    type: CrmActivityType;
    status?: CrmActivityStatus;
    subject: string;
    notes?: string;
    companyId?: string | null;
    contactId?: string | null;
    dealId?: string | null;
    assignedToId?: string | null;
    assignedToName?: string;
    occurredAtMs?: number;
    dueAtMs?: number | null;
    completedAtMs?: number | null;
}

export type CrmActivityPatch = Partial<Pick<
    CrmActivity,
    | 'type'
    | 'status'
    | 'subject'
    | 'notes'
    | 'companyId'
    | 'contactId'
    | 'dealId'
    | 'assignedToId'
    | 'assignedToName'
    | 'occurredAtMs'
    | 'dueAtMs'
    | 'completedAtMs'
>>;

export interface CrmUpdateActivityInput {
    activityId: string;
    actor: CrmActor;
    patch: CrmActivityPatch;
}

export interface CrmCompleteActivityInput {
    activityId: string;
    actor: CrmActor;
}

export interface CrmRescheduleActivityInput {
    activityId: string;
    actor: CrmActor;
    dueAtMs: number;
}

export interface CrmArchiveActivityInput {
    activityId: string;
    actor: CrmActor;
}

export interface CrmCreateMemberInput {
    actor: CrmActor;
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    title?: string;
}

export type CrmMemberPatch = Partial<Pick<CrmMember, 'name' | 'email' | 'phone' | 'title'>>;

export interface CrmUpdateMemberInput {
    memberId: string;
    actor: CrmActor;
    patch: CrmMemberPatch;
}

export interface CrmArchiveMemberInput {
    memberId: string;
    actor: CrmActor;
}

export interface CrmQuoteLinkFields {
    quoteOwnerUid: string;
    quoteId: string;
    quoteNumber: string | null;
    quoteRevisionId: string | null;
    quoteVersion: number | null;
    valueSek: number;
}

export interface CrmLinkDealToQuoteInput {
    dealId: string;
    quoteOwnerUid: string;
    quoteId: string;
    quoteNumber?: string | null;
    quoteRevisionId?: string | null;
    quoteVersion?: number | null;
    valueSek?: number;
    user: CrmActor;
}

export interface CrmSyncDealFromQuoteInput extends CrmLinkDealToQuoteInput {
    quoteStatus: string;
}

export interface CrmUnlinkDealFromQuoteInput {
    dealId: string;
    user: CrmActor;
}

export interface CrmRepository {
    getCompany(companyId: string): Promise<CrmCompany | null>;
    listCompanies(options?: CrmListOptions): Promise<CrmPage<CrmCompany>>;
    createCompany(input: CrmCreateCompanyInput): Promise<CrmCompany>;
    updateCompany(input: CrmUpdateCompanyInput): Promise<CrmCompany>;
    archiveCompany(input: CrmArchiveCompanyInput): Promise<CrmCompany>;
    restoreCompany(input: CrmArchiveCompanyInput): Promise<CrmCompany>;
    findCompanyDuplicates(input: CrmCompanyDuplicateQuery): Promise<CrmCompany[]>;

    getContact(contactId: string): Promise<CrmContact | null>;
    listContacts(options?: CrmContactListOptions): Promise<CrmPage<CrmContact>>;
    createContact(input: CrmCreateContactInput): Promise<CrmContact>;
    updateContact(input: CrmUpdateContactInput): Promise<CrmContact>;
    archiveContact(input: CrmArchiveContactInput): Promise<CrmContact>;
    restoreContact(input: CrmArchiveContactInput): Promise<CrmContact>;
    findContactDuplicates(input: CrmContactDuplicateQuery): Promise<CrmContact[]>;

    getDeal(dealId: string): Promise<CrmDeal | null>;
    listDeals(options?: CrmDealListOptions): Promise<CrmPage<CrmDeal>>;
    createDeal(input: CrmCreateDealInput): Promise<CrmDeal>;
    updateDeal(input: CrmUpdateDealInput): Promise<CrmDeal>;
    archiveDeal(input: CrmArchiveDealInput): Promise<CrmDeal>;
    restoreDeal(input: CrmArchiveDealInput): Promise<CrmDeal>;
    changeDealStage(input: CrmChangeDealStageInput): Promise<CrmDeal>;

    getActivity(activityId: string): Promise<CrmActivity | null>;
    listActivities(options?: CrmActivityListOptions): Promise<CrmPage<CrmActivity>>;
    createActivity(input: CrmCreateActivityInput): Promise<CrmActivity>;
    updateActivity(input: CrmUpdateActivityInput): Promise<CrmActivity>;
    completeActivity(input: CrmCompleteActivityInput): Promise<CrmActivity>;
    reopenActivity(input: CrmCompleteActivityInput): Promise<CrmActivity>;
    rescheduleActivity(input: CrmRescheduleActivityInput): Promise<CrmActivity>;
    archiveActivity(input: CrmArchiveActivityInput): Promise<CrmActivity>;
    restoreActivity(input: CrmArchiveActivityInput): Promise<CrmActivity>;

    getMember(memberId: string): Promise<CrmMember | null>;
    listMembers(options?: CrmListOptions): Promise<CrmPage<CrmMember>>;
    createMember(input: CrmCreateMemberInput): Promise<CrmMember>;
    updateMember(input: CrmUpdateMemberInput): Promise<CrmMember>;
    archiveMember(input: CrmArchiveMemberInput): Promise<CrmMember>;
    restoreMember(input: CrmArchiveMemberInput): Promise<CrmMember>;

    searchAll(options: CrmSearchOptions): Promise<CrmSearchResults>;
    linkDealToQuote(input: CrmLinkDealToQuoteInput): Promise<CrmDeal>;
    syncDealFromQuote(input: CrmSyncDealFromQuoteInput): Promise<CrmDeal>;
    unlinkDealFromQuote(input: CrmUnlinkDealFromQuoteInput): Promise<CrmDeal>;
}
