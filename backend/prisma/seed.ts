import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Capital 21 Play database...')

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@Capital21!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@capital21.mx' },
    update: {},
    create: {
      email: 'admin@capital21.mx',
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'Administrador Capital 21',
      role: Role.ADMIN,
      isActive: true,
    },
  })

  // Content Manager
  const cmPassword = await bcrypt.hash('ContentMgr@Capital21!', 12)
  const contentManager = await prisma.user.upsert({
    where: { email: 'contenido@capital21.mx' },
    update: {},
    create: {
      email: 'contenido@capital21.mx',
      username: 'gestor_contenido',
      passwordHash: cmPassword,
      displayName: 'Gestor de Contenido',
      role: Role.CONTENT_MANAGER,
      isActive: true,
    },
  })

  // Sample broadcaster
  const bvPassword = await bcrypt.hash('Broadcaster@Capital21!', 12)
  const broadcaster = await prisma.user.upsert({
    where: { email: 'broadcastertest@capital21.mx' },
    update: {},
    create: {
      email: 'broadcastertest@capital21.mx',
      username: 'broadcaster_test',
      passwordHash: bvPassword,
      displayName: 'Televisora Demo',
      role: Role.BROADCASTER_VIEWER,
      isActive: true,
    },
  })

  // Sample series
  const series = await prisma.series.upsert({
    where: { slug: 'noticiero-capital-21' },
    update: {},
    create: {
      title: 'Noticiero Capital 21',
      slug: 'noticiero-capital-21',
      description: 'El noticiero institucional del Servicio de Medios Públicos de la Ciudad de México.',
      synopsis: 'Información, análisis y cobertura de los hechos más relevantes de la Ciudad de México y el mundo.',
      genre: ['Noticias', 'Información'],
      tags: ['noticias', 'cdmx', 'informacion'],
      year: 2024,
      isPublished: true,
    },
  })

  const season1 = await prisma.season.upsert({
    where: { seriesId_number: { seriesId: series.id, number: 1 } },
    update: {},
    create: {
      seriesId: series.id,
      number: 1,
      title: 'Temporada 1 - 2024',
      description: 'Primera temporada del Noticiero Capital 21.',
      year: 2024,
      isPublished: true,
    },
  })

  await prisma.episode.upsert({
    where: { seasonId_number: { seasonId: season1.id, number: 1 } },
    update: {},
    create: {
      seasonId: season1.id,
      number: 1,
      title: 'Episodio 1 - Inauguración',
      description: 'Primer episodio de la temporada 2024.',
      duration: 1800,
      isPublished: true,
      uploadStatus: 'COMPLETED',
    },
  })

  // Grant permissions to broadcaster
  await prisma.contentPermission.upsert({
    where: { id: 'seed-perm-series-1' },
    update: {},
    create: {
      id: 'seed-perm-series-1',
      userId: broadcaster.id,
      contentType: 'SERIES',
      permissionLevel: 'SERIES',
      seriesId: series.id,
      canStream: true,
      canDownload: true,
      grantedById: contentManager.id,
    },
  })

  console.log('✅ Seed complete.')
  console.log(`   Admin: admin@capital21.mx / Admin@Capital21!`)
  console.log(`   Content Manager: contenido@capital21.mx / ContentMgr@Capital21!`)
  console.log(`   Broadcaster: broadcastertest@capital21.mx / Broadcaster@Capital21!`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
