-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conexion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "motor" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "puerto" INTEGER NOT NULL,
    "baseDeDatos" TEXT NOT NULL,
    "usuarioDb" TEXT NOT NULL,
    "credencial" TEXT NOT NULL,
    "soloLectura" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conexion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultaGuardada" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "sql" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultaGuardada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conexion_tenantId_idx" ON "Conexion"("tenantId");

-- CreateIndex
CREATE INDEX "ConsultaGuardada_tenantId_idx" ON "ConsultaGuardada"("tenantId");

-- AddForeignKey
ALTER TABLE "Conexion" ADD CONSTRAINT "Conexion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultaGuardada" ADD CONSTRAINT "ConsultaGuardada_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
