# Team CRM

A shared contact manager for a small team: people and companies with their history, tasks, sales pipelines and a calendar, with per-teammate access control.

Inspired by https://lessannoyingcrm.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep people and companies with emails, phones, address, background and your own custom fields; search, filter, sort and export them to CSV.
- See one history per record of notes, files, tasks, events and pipeline moves, and add, edit or delete your own notes and files.
- Create, assign, complete and reopen tasks, see what's overdue, due today and upcoming, and get a morning agenda email.
- Set up pipelines with ordered statuses and fields, move records through them, and view each as a list or board with totals.
- Sort records into groups shared with the team or private to you, and filter the contact list by group.
- Schedule events with teammates and linked records, in month and week views, with teammates' calendars overlaid.
- Choose, per member and teammate, full, read-only or no access to records, and reassign records in one step.

Left out: accounts and sign-in, which your Gateway handles; mobile apps; email and calendar sync; integrations and a public API; web forms and automations; saved views and extra reports; event reminders; contact import.

## Setup

- Install from a release: `pnpm everyapp install <repository url>`.
- Develop: `pnpm install`, then `pnpm dev`; `pnpm test` runs the unit tests and `node checks/<suite>.mjs` the release checks through the oss.new runtime.
- Deploy: `pnpm run deploy`.
- No secrets or settings. Storage is the app's D1 database and an R2 bucket for files (R2 must be enabled on the Cloudflare account once).
- Optional: the morning agenda email uses the Gateway's email capability; set up email on your Gateway to turn it on.

## Limitations

- Teammates appear in pickers and on the access page once they have opened the app.
- Files can be up to 25 MB each.
- Amounts are shown in US dollars.
- The agenda email and real deployment were not exercised by the local checks, which run against a Gateway with no email set up.
