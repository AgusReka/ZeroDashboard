import { crearSiFalta, type ClienteSemilla, type TenantDemo } from './comun.js';

/**
 * CH-49 (b2): one dashboard per demo tenant (`Tablero.tenantId` is unique), drawn on that
 * tenant's own connection. It is created only when the tenant has none: a dashboard the
 * owner edited, or one made from the panel, is never read back, updated or replaced. The
 * reports it lists are global and seeded before it (`sembrarReportes`).
 *
 * It runs after `sembrarTenant`, which throws unless the tenant's five views are valid, so a
 * dashboard never points at a connection with no mapping.
 */
export async function sembrarTablero(
  prisma: Pick<ClienteSemilla, 'tablero'>,
  tenant: TenantDemo,
  creadas: string[],
): Promise<void> {
  await crearSiFalta(
    creadas,
    `${tenant.prefijoEtiqueta}tablero`,
    () => prisma.tablero.findUnique({ where: { tenantId: tenant.ids.tenant }, select: { id: true } }),
    () =>
      prisma.tablero.create({
        data: {
          id: tenant.tablero.id,
          tenantId: tenant.ids.tenant,
          conexionId: tenant.ids.conexion,
          reportes: [...tenant.tablero.reportes],
        },
      }),
  );
}
