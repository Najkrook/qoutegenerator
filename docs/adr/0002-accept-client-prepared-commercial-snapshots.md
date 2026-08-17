---
status: accepted
---

# Accept client-prepared commercial snapshots

Quote Revision `commercialSnapshot` v1 is an approved additive persistence shape. For the current three-person, trusted-user deployment, explicit runtime allowlists plus authenticated owner/admin Firestore access, fixed envelope validation, and row-count limits are a proportionate boundary; exact Firestore validation of every embedded row field is deliberately out of scope.

Revisit this decision before adding untrusted external writers, materially expanding the user base, or treating snapshots as compliance-grade records. That future change may require a trusted server write endpoint or a document-per-row representation, together with a versioned migration and deletion/read-path changes.
