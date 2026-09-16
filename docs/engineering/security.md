
# Security Engineering Rules

## 1. Secrets & Sensitive Data
- Never hardcode secrets, API keys, passwords, or tokens.
- Never commit secrets or expose sensitive data in logs.
- Store credentials using approved secure mechanisms; never plain text.
- Do not log tokens, authentication headers, passwords, or personal information.
- Minimize collection, storage, and exposure of sensitive user data.
- Do not expose secrets in client bundles, source maps, or error messages.

## 2. Transport & Input Security
- Use HTTPS; never disable TLS or certificate validation.
- Treat URLs, API responses, media metadata, and user content as untrusted.
- Validate and sanitize input at every trust boundary.
- Prevent injection, path traversal, unsafe redirects, and malicious content handling.
- Use secure defaults; reject invalid, unexpected, or malformed input.

## 3. Authentication & Authorization
- Enforce authentication and authorization server-side.
- Use least privilege and minimum required permissions.
- Verify ownership and access rights for every protected resource and action.
- Never trust client-side authorization, hidden UI controls, or user-supplied roles.
- Handle sessions, tokens, expiry, logout, and unauthorized responses securely.

## 4. Application & Dependency Security
- Avoid unsafe WebViews, dynamic code execution, and insecure deep links.
- Review dependencies for vulnerabilities, unnecessary permissions, and supply-chain risks.
- Keep dependencies and security-sensitive libraries updated through approved changes.
- Protect sensitive operations against replay, duplicate requests, and unauthorized execution.
- Never weaken security to make tests or builds pass.

## 5. Errors, Logging & Recovery
- Handle errors without exposing secrets or internal implementation details.
- Do not swallow security failures or silently bypass security checks.
- Fail securely; deny access when authorization or security validation fails.
- Report security risks before applying workarounds.

## 6. Verification & Compliance
- Verify security controls at relevant trust boundaries and user journeys.
- Review changed code for security regressions before completion.
- Keep security-sensitive configuration separate from application code.
- Do not claim security compliance or vulnerability-free status without evidence.