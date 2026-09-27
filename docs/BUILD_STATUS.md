# Build Status — v1.0.2

## Fix applied
- Vite now uses each app directory as its build root so `index.html` resolves correctly.
- Super Admin output: `dist/super-admin`
- Clinic Admin output: `dist/clinic-admin`
- Root build command remains `npm run build`.

## Verification
Run from the repository root:

```powershell
npm install
npm run build
npm run typecheck
```
