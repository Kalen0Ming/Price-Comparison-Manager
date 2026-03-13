# Objective
Fix preview showing "Your app is starting" indefinitely. Root cause: stale server processes from 06:51 AM (started via `setsid npm run dev`) are holding port 5000 inside a separate session that Replit's port-detection cannot see. The current workflow config (`bash -c 'trap "" HUP; exec npm run dev'`) was never able to start because port 5000 was already occupied by those stale processes.

# Tasks

### T001: 清除旧进程，重启 Workflow
- **Blocked By**: []
- **Details**:
  - Kill all stale server processes (PID 4173, 4184, 4185, 4196, 4577 and any related npm/tsx/node/esbuild processes)
  - Then restart the "Start application" workflow so the new `bash -c 'trap "" HUP; exec npm run dev'` command starts fresh in the same session Replit monitors
  - Verify `Open ports: [5000]` is returned by workflow status (confirming detection works)
  - Acceptance: Replit preview loads the app instead of showing "Your app is starting"
