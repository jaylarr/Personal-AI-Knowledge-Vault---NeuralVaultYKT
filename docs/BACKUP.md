# Local backup and recovery

Use **Backup & restore** in the owner workspace. The operation runs locally and reports success only after the portable manifest and every copied file have been verified. Interrupted/failed operations preserve incomplete output. The default destination is `.artifacts/exports/<operation-id>/`. Restoring through the UI creates a separate `.artifacts/restore-rehearsal/<operation-id>/Vault` and never switches or merges the current vault.

A copy on the same disk does not protect against disk loss. Copy the complete verified package, including `manifest.json`, to separate storage. Keep that package private: it contains your original source material and knowledge. No backup schedule is installed.

The package contains Markdown, exact source originals, source versions, lifecycle history, IDs, evidence, collections, manual overrides, transaction receipts and safe operational metadata. Derived indexes, temporary uploads, environment/DPAPI files, locks and temporary files are excluded. Committed staging copies are redundant with their published immutable outputs; pending transaction stages remain recoverable. Restoration disables old API credentials and processing grants, cancels agent leases and requeues deterministic work. Configure a fresh credential explicitly if you later choose to switch roots.

For an explicit external destination, use the local command helpers after `pnpm build:shared`:

```powershell
node --import tsx scripts/backup-local-vault.ts --vault "C:\absolute\Vault" --destination "E:\Backups\Atlas-new-folder"
node --import tsx scripts/restore-local-vault.ts --package "E:\Backups\Atlas-new-folder" --destination "C:\absolute\Atlas-Restored"
```

The destination must not exist. A backup must be separate from the source vault. Restore validates the complete manifest, paths, hashes, sizes, reserved names, case collisions and reparse boundaries before writing. Existing destinations and incomplete/corrupt packages are refused. Never restore over the working vault.

`pnpm test:recovery` exercises a fictional source, owner-reviewed evidence, portable export, fresh-folder restore and retrieval through a new API and stdio MCP process. This is local process evidence; it does not prove an off-device disaster recovery drill. Current limits and observed results are in `LOCAL_COMPLETION_REPORT.md`.
