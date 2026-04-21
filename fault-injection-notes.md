# Fault Injection Log
## Project: ci-pipeline-app | Week 5 Capstone

Each stage was faulted independently. After recording the result, the fault was
reverted and the pipeline confirmed green before the next fault was introduced.

---

## Fault 1 — Lint Stage Failure

**Injection method:**
Introduced a deliberate ESLint violation in `src/index.js`:

```js
// Added an unused variable — violates no-unused-vars rule
const unusedVar = 'this will break lint';
```

**Observed behaviour:**
| Stage          | Result  |
|----------------|---------|
| Lint           | FAILED  |
| Build          | SKIPPED |
| Verify (Test)  | SKIPPED |
| Verify (Audit) | SKIPPED |
| Archive        | SKIPPED |
| Publish        | SKIPPED |

**Post block behaviour:**
- `always` ran — workspace cleaned
- `failure` ran — failure notification printed
- `success` did NOT run

**Why this is the correct design decision:**
Lint runs first precisely so that malformed code never consumes build, test, or
registry resources; a style or syntax error caught in under 30 seconds costs
nothing compared to a broken artifact reaching Nexus.

**Resolution:** Removed unused variable. Pipeline returned to green. ✅

---

## Fault 2 — Build Stage Failure

**Injection method:**
Introduced a syntax error in the inline node script inside the Build stage:

```groovy
// Removed closing parenthesis to break the node -e call
sh 'node -e "const fs = require(\'fs\'; "'
```

**Observed behaviour:**
| Stage          | Result  |
|----------------|---------|
| Lint           | PASSED  |
| Build          | FAILED  |
| Verify (Test)  | SKIPPED |
| Verify (Audit) | SKIPPED |
| Archive        | SKIPPED |
| Publish        | SKIPPED |

**Post block behaviour:**
- `always` ran — workspace cleaned
- `failure` ran — failure notification printed

**Why this is the correct design decision:**
There is no value in running tests against a build output that does not exist;
skipping all downstream stages immediately surfaces the real problem without
producing misleading test results.

**Resolution:** Restored correct node script. Pipeline returned to green. ✅

---

## Fault 3 — Test Branch Failure (inside Verify parallel)

**Injection method:**
Modified `test/index.test.js` to assert an incorrect expected value:

```js
// Changed expected status from 'ok' to 'broken'
expect(res.body.status).toBe('broken');
```

**Observed behaviour:**
| Stage           | Result  |
|-----------------|---------|
| Lint            | PASSED  |
| Build           | PASSED  |
| Verify (Test)   | FAILED  |
| Verify (Audit)  | PASSED  |
| Archive         | SKIPPED |
| Publish         | SKIPPED |

**Post block behaviour:**
- `always` ran — workspace cleaned, test results (with failure) published
- `failure` ran — failure notification printed

**Why this is the correct design decision:**
The parallel Verify stage allows the Security Audit branch to run to completion
even when Test fails, giving the team full information (both test failures AND
any security findings) in a single pipeline run rather than hiding audit results
behind a test gate.

**Resolution:** Restored correct assertion. Pipeline returned to green. ✅

---

## Fault 4 — Security Audit Branch Failure (inside Verify parallel)

**Injection method:**
Temporarily added a known vulnerable package to `package.json` and lowered the
audit threshold to `moderate` in `package.json` scripts:

```json
"audit:ci": "npm audit --audit-level=moderate"
```
Then installed a package with a known moderate vulnerability to trigger failure.

**Observed behaviour:**
| Stage           | Result  |
|-----------------|---------|
| Lint            | PASSED  |
| Build           | PASSED  |
| Verify (Test)   | PASSED  |
| Verify (Audit)  | FAILED  |
| Archive         | SKIPPED |
| Publish         | SKIPPED |

**Post block behaviour:**
- `always` ran — workspace cleaned
- `failure` ran — failure notification printed

**Why this is the correct design decision:**
A package with known vulnerabilities must never reach the artifact registry;
blocking Archive and Publish when Audit fails ensures the registry stores only
security-verified artifacts.

**Resolution:** Removed vulnerable package, restored audit level. Pipeline
returned to green. ✅

---

## Fault 5 — Publish Stage Failure

**Injection method:**
Replaced the real credential ID in `withCredentials` with a non-existent ID:

```groovy
credentialsId: 'nexus-npm-credentials-WRONG',
```

**Observed behaviour:**
| Stage          | Result  |
|----------------|---------|
| Lint           | PASSED  |
| Build          | PASSED  |
| Verify (Test)  | PASSED  |
| Verify (Audit) | PASSED  |
| Archive        | PASSED  |
| Publish        | FAILED  |

**Post block behaviour:**
- `always` ran — workspace cleaned, `.npmrc` confirmed deleted (the `rm -f`
  in the always block acts as a safety net even though Publish failed mid-step)
- `failure` ran — failure notification printed

**Credential safety check:**
Even though Publish failed, no credential appeared in the build log. Jenkins
masked the secret before the shell command was attempted, and the `.npmrc` file
was never written because `withCredentials` failed to bind. Verified by scanning
the console output.

**Why this is the correct design decision:**
Failing at Publish after a successful Archive means the artifact exists in
Jenkins but was not promoted to Nexus; the team has a verified build they can
re-publish by fixing the credential without re-running the full pipeline.

**Resolution:** Restored correct credential ID. Pipeline returned to green. ✅

---

## Summary Table

| Fault # | Stage Broken    | First Skip      | Artifact in Nexus? | Credentials Leaked? |
|---------|----------------|-----------------|-------------------|---------------------|
| 1       | Lint           | Build           | No                | No                  |
| 2       | Build          | Verify          | No                | No                  |
| 3       | Test (Verify)  | Archive         | No                | No                  |
| 4       | Audit (Verify) | Archive         | No                | No                  |
| 5       | Publish        | N/A (last stage)| No                | No                  |

All faults resolved. Pipeline green after each resolution. ✅