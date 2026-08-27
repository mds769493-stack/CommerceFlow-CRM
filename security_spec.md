# Firebase Security Specification - CommerceFlow

## Data Invariants
- A FollowUp record MUST have a `userId` matching the authenticated user's UID.
- `orderId` or `consignmentId` must be present.
- `createdAt` and `updatedAt` must be valid server timestamps.
- Document IDs must be valid alphanumeric strings.

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Creating a record with someone else's `userId`. (Reject)
2. **Ghost Update**: Authenticated user trying to update a record they don't own. (Reject)
3. **Shadow Field Injection**: Adding an unmapped field like `isAdmin: true` during update. (Reject)
4. **Timestamp Forgery**: Providing a client-side `updatedAt` string instead of `request.time`. (Reject)
5. **ID Poisoning**: Injecting a 2MB string as a document ID. (Reject)
6. **Anonymous Breach**: Trying to read records without being signed in. (Reject)
7. **Cross-Tenant List**: Authenticated user fetching all records without a `userId` filter. (Reject)
8. **Negative Count**: Setting `callCount` to `-1`. (Reject)
9. **Status Escalation**: Changing an immutable `createdAt` field after creation. (Reject)
10. **Resource Exhaustion**: Sending a 1MB string into the `note` field. (Reject)
11. **Type Poisoning**: Sending a boolean into the `orderId` string field. (Reject)
12. **Unverified Sync**: User with an unverified email trying to write data (if verification is strictly required). (Reject)

## The Test Runner (Plan)
- We will verify that `request.auth.uid == resource.data.userId`.
- We will verify field types and sizes for all updates.
- We will use `affectedKeys().hasOnly()` for tight update control.
