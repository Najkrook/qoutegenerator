# Deepen the Quote Save workflow

Quote Save will be a deep module with two interface operations: save a Quote Revision and repair a CRM Link. Quote persistence defines success; the module enforces one Quote Revision per Save Intent, preserves Quote Owner and Quote Origin, records durable CRM Synchronization Issues, requires explicit relinking, and treats Activity Log Entries as non-authoritative.

CRM Repair remains client-side with bounded session retries, retry on reopen, and a manual action. Persisted metadata changes are additive, existing records require no backfill, callers and behavioral tests use the module interface, and Firestore transaction and rules tests remain at the production adapter seam.
