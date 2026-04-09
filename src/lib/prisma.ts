import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const prismaClientSingleton = () => {
  const adapter = new PrismaMariaDb({
    host: 'localhost',
    user: 'root',
    database: 'ev_fleet',
    // increased connection limit directly
    connectionLimit: 50,
  } as any) // Casting as any to bypass strict type check on internal pool config

  return new PrismaClient({ 
    adapter,
    log: ['error', 'warn'],
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
