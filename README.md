# relic-vault

## Preview access (Board decision #273)

Board decision #273 (2026-09-19): the preview is invite-only. Only users the Board invites with the 'playtester' role can reach the game; everyone else is sent to sign in. Invite from the Azure Portal: Static Web App relic-vault -> Role management -> Invite -> role 'playtester'.

`public/staticwebapp.config.json` carries those rules. It holds **no `_comment` key**: Azure's schema forbids extra
top-level properties, and the Static Web Apps CLI refuses to apply a config that has one, so a deploy would publish
the site with the invite-only routes silently dropped (found 2026-09-20 deploying by hand while CI has no agents).
