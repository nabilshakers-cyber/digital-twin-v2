# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every document in `users/{userId}` and its subcollections (`tasks`, `schedule`, `goals`, `quranRoutine`, `customWidgets`, `phoneAppLists`) MUST belong exclusively to the authenticated, email-verified user whose `request.auth.uid == userId` and `data.ownerId == request.auth.uid`.
2. All document path IDs (`userId`, `taskId`, `blockId`, `goalId`, `itemId`, `widgetId`, `listId`) must be non-empty strings `<= 128` characters matching `^[a-zA-Z0-9_\-]+$`.
3. Every subcollection document must match its path ID (`data.id == docId`), possess an immutable `ownerId == userId`, and possess server-validated timestamps (`createdAt == request.time` on create; `createdAt` immutable and `updatedAt == request.time` on update).
4. Every string and list field must enforce explicit `.size()` boundaries to prevent resource exhaustion / denial-of-wallet attacks.
5. `users/{userId}` does not allow `list` queries and restricts `get`, `create`, `update`, `delete` strictly to the owner. Subcollections require `allow list` to explicitly enforce `isOwner(userId) && existing().ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected Result: `PERMISSION_DENIED`)
1. **Unauthenticated read/write**: Any read or write to `/users/uid1/tasks/t-1` when `request.auth == null`.
2. **Unverified email write**: Authenticated request where `request.auth.token.email_verified == false`.
3. **Cross-user read (`get`)**: User `uid2` attempts to read `/users/uid1/tasks/t-1` or `/users/uid1`.
4. **Cross-user `list`**: User `uid2` attempts to list `/users/uid1/tasks` or `/users/uid1/schedule`.
5. **Identity spoofing on create**: User `uid1` creates `/users/uid1/tasks/t-99` with `ownerId: "uid2"`.
6. **Immutable `ownerId` hijack on update**: User `uid1` updates `/users/uid1/tasks/t-1` attempting to change `ownerId` to `"uid2"`.
7. **Shadow / Ghost field injection**: User `uid1` creates or updates a task with an undeclared field `{ isAdmin: true }` or `{ role: "superadmin" }`.
8. **Invalid document ID poisoning**: User `uid1` creates `/users/uid1/tasks/invalid$id..` or a 500-character document ID.
9. **String size overflow (Denial of Wallet)**: User `uid1` creates a task with a `title` of 5,000 characters (`> 300`).
10. **Client-forged timestamp**: User `uid1` creates or updates `/users/uid1/schedule/sb-1` with a hardcoded past ISO/Timestamp instead of `request.time`.
11. **Unbounded array injection**: User `uid1` creates a task with `subtasks` containing 51 items (`> 50`) or `dashboardLayout` with 61 items (`> 60`).
12. **Type poisoning on whitelisted update key**: User `uid1` updates `progress` on `/users/uid1/goals/goal-1` to `"100%"` (string instead of number) or `150` (`> 100`).
