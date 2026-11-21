# Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}` belongs strictly to the authenticated user whose `request.auth.uid == userId`.
2. Every workspace slice under `/users/{userId}/workspace/{storeKey}` requires an existing parent `/users/{userId}` document (Master Gate), verified email on writes, and strict `ownerId == userId == request.auth.uid`.
3. `uid`, `ownerId`, `storeKey`, and `createdAt` are immutable after creation.
4. `createdAt` and `updatedAt` must equal server `request.time`.
5. No unauthenticated or cross-user read, list, create, update, or delete is permitted anywhere in the database.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /users/u1` with `auth = null`.
2. **Cross-User Profile Read (PII Leak)**: `GET /users/u2` as `uid = u1`.
3. **Cross-User Workspace List**: `LIST /users/u2/workspace` as `uid = u1`.
4. **Unverified Email Write**: `CREATE /users/u1` with `email_verified = false`.
5. **Identity Spoofing on Create**: `CREATE /users/u1/workspace/workspace_tasks_v2` with `ownerId: "u2"`.
6. **Shadow Field Injection**: `CREATE /users/u1` with extra ghost field `isAdmin: true`.
7. **ID Poisoning**: `CREATE /users/u1/workspace/bad$id..!` with illegal characters or >128 chars.
8. **Orphaned Subcollection Write**: `CREATE /users/u1/workspace/workspace_tasks_v2` when `/users/u1` does not exist.
9. **Client Timestamp Forgery**: `CREATE /users/u1` with client-supplied `createdAt` != `request.time`.
10. **Immutable Field Mutation**: `UPDATE /users/u1/workspace/workspace_tasks_v2` changing `ownerId` or `createdAt`.
11. **Value Poisoning / Oversized Payload**: `UPDATE /users/u1/workspace/workspace_doc_content_f1` with `textValue` > 200,000 chars or `items` > 250 items.
12. **Arbitrary Unknown Collection Write**: `CREATE /secrets/leak` as an authenticated user (caught by default-deny rule).
