# Exploration: CH-26 — Freshness warning on activation (2026-10-16)

Status: **decided** (2026-10-16): option 1, registered as DEC-180. Store: openspec. Story: F3 (R3). Related: DEC-142 to DEC-144 (CH-24), DEC-137 to DEC-139 (panel), DEC-66, DEC-128.

## Why

F3: "Como P2, quiero que me adviertan si activo algo que mi réplica no sostiene. Advertencia explícita al activar; decide el cliente, informado." DEC-142 left this warning to CH-26 and kept the engine untouched: an automation whose template tolerates less staleness than the replica's window keeps running, and only the console marks it as outdated.

## What exists (verified)

| Piece | State |
|---|---|
| Tenant window | `Tenant.ventanaDesactualizacionMinutos` (DEC-144), set from the console's Frescura screen (`PUT /tenants/:id/frescura`). |
| Template tolerance | `Plantilla.toleranciaFrescuraMinutos`, provisional 60 and 120 min (DEC-128). |
| Comparison | Frescura screen only: «Al día», «Desactualizada», «Sin declarar» per template (`src/frescura.ts:20-25`). Informative (DEC-142). |
| Who activates | Only P1, in the console wizard «Nueva automatización». The wizard already loads the catalog with each tolerance (`src/consola.ts:2430`) and the tenant list with the window; its template cards already show a blocking reason when the mapping is not valid (DEC-127). |
| Panel (P2) | `GET /api/panel/automatizaciones` lists `activas` and `disponibles`. DEC-137 omitted the «Activar» and «Ajustar» actions; CH-23 later added «Ajustar» (DEC-138). **P2 cannot activate or create anything.** A deactivated automation is never reactivated (DEC-79). |

So F3's trigger, "P2 activates", does not exist in the product.

## Decision needed (not mine to take)

1. **Warn P1 in the console wizard.** A template card whose tolerance is below the tenant's window says so («La réplica se actualiza cada N; esta plantilla tolera M.») and can still be chosen; the creation notice repeats it. Same text in «Ajustar» is not needed: the template does not change there. Reinterprets F3's actor (P1 activates, on behalf of the client); front only, no route, no engine change. ~150 lines.
2. **Tell P2 in the panel.** Each active automation whose template is outdated for the tenant shows a business-language notice («Tus datos se actualizan cada N; este aviso necesita datos más recientes»). Changes the DEC-137 read contract (one field per automation). Informs the client, but there is no activation to warn on and nothing for P2 to decide. ~200 lines.
3. **Build «Activar» in the panel with the warning.** The literal story: P2 creates an automation from `disponibles`. Needs connection choice, values and schedule for P2, which DEC-137 and DEC-04 kept out of the panel. New capability, large; close to anti-scope.
4. **Close F3 as an artifact limit.** P2 never activates; the console already shows «Desactualizada» (DEC-142). Record the limit in a DEC and mark CH-26 out of scope. No code.

Recommendation: (1). It puts the warning exactly where activation happens today, reuses data the wizard already has, and keeps the engine and the panel contract as they are. (2) can follow later if the client needs to see it.

## Risks

- (1) and (2): with no window declared («Sin declarar») there is nothing to compare; the warning must stay silent, not guess.
- Tolerances are provisional (DEC-128): a warning built on them can be noisy until real values exist.
- Any option that blocks activation would amend DEC-142 and touch the engine's closed rejection set (rule 6); none of the four does.
