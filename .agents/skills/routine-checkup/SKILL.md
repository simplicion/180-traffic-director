---
name: routine-checkup
description: Automated routine checkup for 180workspace architecture best practices, user (userId) isolation, and code health.
---

# Routine Checkup & Engineering Standards

When the user asks to "run a routine checkup" or "run the routine checkup script", you MUST perform a deep architectural inspection and automated fix across the active domain or specified files.

## 1. User Isolation (`userId`)
The platform relies on user-scoped data ownership (`userId`). Data isolation is maintained across all models (TrafficLink, TrafficRule, TrafficLog, TrafficPixelConfig, TrafficDirectorSubscription, DomainRegistry). Requests authenticate via JWT/DevToken and resolve `userId` from the authenticated session context.

**Checkup Actions:**
1. **Remove Hardcoded `companyId`**: All `Company` models and `companyId` columns have been permanently removed. Ensure no legacy references or queries attempt to use `companyId`.
2. **User-Scoped Queries**: Ensure database queries and mutations for personal assets filter or associate by `userId`.
3. **Late Binding Context**: If background jobs, queues, or specific edge cases require user context, ensure `userId` is passed directly from validated tokens or payloads.

## 2. Robust Engineering Practices
Ensure the code adheres to senior-level engineering standards:
1. **Single Source of Truth**: Data dependencies like `userId` should flow from the request middleware, not manual untrusted client payload injection.
2. **Robust Error Handling**: Never swallow errors (`catch (e) {}`). Ensure `console.error` or a standardized logger captures the stack trace.
3. **No 'any' Abuse**: In new files or during deep refactoring, ensure strict typings are used instead of `any` wherever possible.

## 3. Execution Workflow
When executing this checkup:
1. **Identify**: Determine the domain or service to check.
2. **Pre-Check**: Run TypeScript compiler or test suite.
3. **Scan**: Verify that queries are properly scoped to `userId` and no deprecated `companyId` exists.
4. **Refactor**: Apply fixes using the file editing tools carefully.
5. **Verify**: Run `tsc --noEmit` again to verify no regressions or TypeScript errors were introduced.
6. **Report**: Produce a final markdown summary documenting exactly what was checked and what was automatically fixed.
