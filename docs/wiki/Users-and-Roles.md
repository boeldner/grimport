# Users and Roles

Grimport separates *who runs the panel* from *who owns which site*. That split is
what makes it safe to invite friends: a member can create and manage their own
sites without ever seeing anyone else's, while the owner keeps the ability to
step in when something breaks.

## Platform roles

| Role | Who | Can |
|---|---|---|
| `owner` | Exactly one — whoever installed Grimport | Everything: users, domains, updates, backups, panel settings, every site |
| `admin` | An optional trusted co-admin | Same as owner, except promoting/demoting other admins and deleting them — only the owner does that |
| `member` | An invited friend | Creates and owns sites within their quota, invites collaborators to their own sites, manages their own tokens |
| `guest` | Someone with no sites of their own | Nothing by default — only whatever site role a member or admin grants them |

Owner and admin have an implicit `owner` role on **every** site. That's what
makes support mode work (see below) — there is no separate "super-admin"
concept, it falls out of the role check itself.

## Site roles

Every site has exactly one owner and any number of collaborators, tracked per
site rather than globally:

| Site role | Can |
|---|---|
| `owner` | Everything on the site: delete, transfer, manage collaborators, change the domain |
| `editor` | Deploy, roll back, preview, edit settings — except domain changes, deletion and collaborators |
| `viewer` | Read-only: status, logs, analytics, deploy history |

## Capability presets

A member's quota and permissions are called their *capabilities*. Two presets
cover the common cases; an admin can also set a custom mix per user from
**Settings → Users → Edit**.

| Capability | Beginner (default) | Maker |
|---|---|---|
| Runtimes | Static only | Static, PHP, Node, Python |
| Max sites | 3 | 10 |
| Max upload | 100 MB | 250 MB |
| Disk quota | 1000 MB | 5000 MB |
| Custom domains | Needs approval | Needs approval (or free — see policy below) |
| API tokens | Yes, scoped to their own sites | Yes |
| Webhooks | No | Yes, on their own sites |
| Advanced UI | No — see "Beginner mode" below | Yes |

Guests always have `max_sites: 0` regardless of preset — they only ever act
through a site role someone else granted them.

Panel-wide defaults live in **Settings → General → Members**: the default
preset for new invitations, whether custom domains need approval or apply
immediately, and how many hours an invitation link stays valid.

## Inviting someone

**Settings → Users → Invite** opens a form: their name (used as the
invitation's label, not a login), platform role, capability preset, and link
validity (48 hours by default). Submitting shows a one-time link —
`https://your-panel/invite/<token>` — meant to be pasted into a chat. The link:

- works exactly once,
- is stored hashed, never in plaintext,
- expires on its own after the chosen number of hours,
- can be revoked any time from **Open invitations** before it's used.

The invitee opens the link, picks a username and password, and lands in the
panel with the role and capabilities the invitation carried. No email, no SMTP.

Need an account without sending a link? **Create without invitation** at the
bottom of the Users tab still creates one directly with a password you set.

## Collaborators (site members)

Anyone who owns a site can add collaborators to it from **Site settings →
Access**: search a username, pick `viewer` or `editor`, and save. Collaborators
see the site in their own Sites list with the role they were given; editors can
deploy and change settings but can't touch the domain, delete the site, or
manage its collaborators. A read-only version of the same list is shown to
editors so they can see who else has access.

## Transferring ownership

The site owner can hand a site to another member or admin from the same
Access tab (**Transfer ownership…**). Search for the new owner, confirm, and
the site — including its container and deploy history — is now theirs. The
previous owner keeps whatever collaborator role they're given afterwards, if
any; transferring is one-way and cannot be undone by the person who gave the
site away.

## Support mode

When an owner or admin opens a site they don't own and aren't a collaborator
on, every modal for that site (settings, deploy, logs, analytics, DNS,
history) shows a banner: *"Support mode — this site belongs to \<name\>. Your
actions are logged and \<name\> is notified."* Every action taken this way is
written to the activity log against the site's owner, and the owner gets a
bell notification naming what was done. Support access is never silent.

## Suspension

Admins can suspend a site (stopping its container and marking it with a red
"Suspended" badge) from the card's overflow menu, with an optional reason.
Suspended sites can't be deployed to or started by their owner or
collaborators — only an admin can unsuspend them. Disabling a user account
suspends every site they own in the same step; re-enabling brings them back.

## Domain requests

Members get an automatic address — `<slug>.<base domain>` — for every site
they create, no DNS knowledge required. If they ask for something else, one
of two things happens depending on the panel's domain policy:

- **Needs approval** (default): the request is queued; the panel owner sees
  it under **Domains → Domain requests** with Approve/Reject buttons, and the
  requester's site keeps its automatic address until a decision is made.
- **Free**: the custom domain applies immediately, same as an admin creating
  a site.

A pending request shows as a badge on the site's Domain field in Settings, and
the Domains nav item carries a count badge for admins while requests are
outstanding.

## What members see

A member's panel is intentionally smaller than an admin's:

- Sites list, Overview and Activity are scoped to sites they own or
  collaborate on.
- The New Site modal only offers runtimes their capability allows, shows
  "X of N sites used", and treats the domain field as optional.
- Settings only exposes their own API Tokens and Security (password, profile,
  display name) — no Server, Webhooks, Notifications or Users tabs.
- **Beginner mode** (capability `advanced_ui: false`, the default for the
  Beginner preset): the site settings modal shows only General and Access;
  Behaviour and App config sit behind a "Show advanced settings" link,
  remembered per browser. The Deploy modal loses the "From URL" tab — only
  zip uploads.

See [API Reference](API-Reference) for the underlying endpoints, and
[Security Model](Security-Model) for how site isolation keeps one member's
site from ever reaching another's.
